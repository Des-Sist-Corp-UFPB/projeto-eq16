import { encrypt } from './crypto';

/**
 * Camada REST do Discord (serverless — sem bot 24/7).
 *
 * Tudo aqui são chamadas HTTPS simples a partir das nossas API Routes:
 * - OAuth (vincular conta, escopos `identify` + `guilds.join`)
 * - adicionar o usuário ao servidor via Bot Token
 */

const DISCORD_API = 'https://discord.com/api/v10';

export const DISCORD_OAUTH_SCOPES = ['identify', 'guilds.join'] as const;

interface DiscordConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function getDiscordConfig(): DiscordConfig {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  // NEXTAUTH_URL tem prioridade. Fallback: VERCEL_URL (definido automaticamente pelo Vercel,
  // sem protocolo) ou localhost para dev local.
  const rawBase =
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const baseUrl = rawBase.replace(/\/$/, ''); // remove trailing slash se houver

  if (!clientId || !clientSecret) {
    throw new Error('DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET não configurados.');
  }

  return { clientId, clientSecret, redirectUri: `${baseUrl}/api/discord/callback` };
}

/** URL de autorização do Discord para iniciar o fluxo de vínculo. */
export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getDiscordConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DISCORD_OAUTH_SCOPES.join(' '),
    state,
    prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export interface DiscordTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/** Troca o `code` do callback pelos tokens OAuth. */
export async function exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getDiscordConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`Falha ao trocar code por token (${res.status}).`);
  }
  return res.json();
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
}

/** Busca o perfil do dono do `access_token` (`/users/@me`). */
export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Falha ao buscar perfil do Discord (${res.status}).`);
  }
  return res.json();
}

/**
 * Adiciona o usuário ao servidor (escopo `guilds.join`).
 * Requer `DISCORD_BOT_TOKEN` + `DISCORD_GUILD_ID`; sem eles, retorna 'skipped'
 * para não bloquear o vínculo enquanto o bot ainda não foi configurado.
 */
export async function addUserToGuild(
  discordUserId: string,
  accessToken: string
): Promise<'joined' | 'already' | 'skipped'> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!botToken || !guildId) return 'skipped';

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken }),
  });

  if (res.status === 201) return 'joined'; // entrou agora
  if (res.status === 204) return 'already'; // já estava no servidor
  throw new Error(`Falha ao adicionar ao servidor (${res.status}).`);
}

/** Cifra um token OAuth para persistência no banco. */
export function encryptToken(token: string): string {
  return encrypt(token);
}

// ─── Canais privados por equipe (Bot Token) ──────────────────────────────────

// Bits de permissão do Discord.
const VIEW_CHANNEL = 1 << 10; // 1024
const SEND_MESSAGES = 1 << 11; // 2048
const ACESSO_CANAL = String(VIEW_CHANNEL | SEND_MESSAGES);

interface BotConfig {
  botToken: string;
  guildId: string;
  categoryId?: string;
}

function getBotConfig(): BotConfig | null {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!botToken || !guildId) return null;
  return { botToken, guildId, categoryId: process.env.DISCORD_TEAMS_CATEGORY_ID };
}

function botHeaders(botToken: string): HeadersInit {
  return { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' };
}

function slugCanal(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return `equipe-${base || 'sem-nome'}`;
}

/**
 * Cria o canal privado da equipe (texto), negando @everyone e liberando o capitão.
 * Retorna o id do canal, ou null se o bot ainda não foi configurado.
 */
export async function createTeamChannel(
  nomeEquipe: string,
  capitaoDiscordId: string
): Promise<string | null> {
  const cfg = getBotConfig();
  if (!cfg) return null;

  const body = {
    name: slugCanal(nomeEquipe),
    type: 0, // GUILD_TEXT
    ...(cfg.categoryId ? { parent_id: cfg.categoryId } : {}),
    permission_overwrites: [
      { id: cfg.guildId, type: 0, deny: String(VIEW_CHANNEL) }, // @everyone (role)
      { id: capitaoDiscordId, type: 1, allow: ACESSO_CANAL }, // capitão (member)
    ],
  };

  const res = await fetch(`${DISCORD_API}/guilds/${cfg.guildId}/channels`, {
    method: 'POST',
    headers: botHeaders(cfg.botToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Falha ao criar canal (${res.status}).`);

  const data = await res.json();
  return data.id as string;
}

/** Libera o acesso de um membro ao canal (permission overwrite). */
export async function addMemberToChannel(channelId: string, discordId: string): Promise<boolean> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return false;

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/permissions/${discordId}`, {
    method: 'PUT',
    headers: botHeaders(botToken),
    body: JSON.stringify({ type: 1, allow: ACESSO_CANAL }),
  });
  return res.ok;
}

/** Revoga o acesso de um membro ao canal (usado ao fechar vaga — Fase 3). */
export async function removeMemberFromChannel(channelId: string, discordId: string): Promise<boolean> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return false;

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/permissions/${discordId}`, {
    method: 'DELETE',
    headers: botHeaders(botToken),
  });
  return res.ok;
}

/** Posta uma mensagem no canal. */
export async function postChannelMessage(channelId: string, content: string): Promise<boolean> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return false;

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: botHeaders(botToken),
    body: JSON.stringify({ content }),
  });
  return res.ok;
}

/** Exclui o canal da equipe (ao deletar a equipe). Best-effort. */
export async function deleteChannel(channelId: string): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return;

  await fetch(`${DISCORD_API}/channels/${channelId}`, {
    method: 'DELETE',
    headers: botHeaders(botToken),
  }).catch(() => {
    // best-effort
  });
}
