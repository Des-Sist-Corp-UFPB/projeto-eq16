/**
 * Cliente do servidor MCP remoto do OP.GG (https://op.gg/open-source/opgg-mcp).
 *
 * FONTE PROVISÓRIA de estatísticas: a Riot ainda não liberou nossa chave de
 * API, então as consultas de perfil/partidas vêm do MCP público do op.gg
 * (Streamable HTTP, sem chave). Quando a chave da Riot sair, basta trocar a
 * implementação deste módulo mantendo as mesmas funções exportadas.
 *
 * Este processo atua como CLIENTE MCP do op.gg e como SERVIDOR MCP para o
 * assistente — um "proxy de composição": tools locais + stats remotas.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const OPGG_MCP_URL = process.env.OPGG_MCP_URL ?? 'https://mcp-api.op.gg/mcp';

/** Região padrão dos invocadores (o torneio é do campus — servidor BR). */
export const REGIAO_PADRAO = process.env.OPGG_REGION ?? 'BR';

let clientPromise: Promise<Client> | null = null;

/** Conexão preguiçosa e reaproveitada; em erro, a próxima chamada reconecta. */
async function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new Client({ name: 'teamfinder-mcp', version: '0.1.0' });
      const transport = new StreamableHTTPClientTransport(new URL(OPGG_MCP_URL));
      await client.connect(transport);
      return client;
    })().catch((err) => {
      clientPromise = null; // permite nova tentativa na próxima chamada
      throw err;
    });
  }
  return clientPromise;
}

async function chamarOpgg(name: string, args: Record<string, unknown>): Promise<string> {
  const client = await getClient();
  const result = await client.callTool({ name, arguments: args });
  const blocos = (result.content ?? []) as { type: string; text?: string }[];
  const texto = blocos
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('\n');
  if (result.isError) {
    throw new Error(texto || `op.gg retornou erro na tool ${name}`);
  }
  return texto;
}

/** `Nome#TAG` -> { gameName, tagLine } (mesma regra do site: TAG de 1 a 5 alfanuméricos). */
export function parseNickname(nickname: string): { gameName: string; tagLine: string } | null {
  const valor = nickname.trim();
  if (!/^[^#]+#[A-Za-z0-9]{1,5}$/.test(valor)) return null;
  const [nome, tag] = valor.split('#');
  return { gameName: nome.trim(), tagLine: tag };
}

// Campos pedidos ao op.gg (o protocolo deles exige selecionar campos explícitos).
const CAMPOS_PERFIL = [
  'data.summoner.league_stats[].tier_info.{tier,division,lp}',
  'data.summoner.league_stats[].{game_type,win,lose}',
  'data.summoner.most_champions.champion_stats[].{champion_name,play,win,lose}',
];

const CAMPOS_PARTIDAS = [
  'data.game_history[].{created_at,game_type,game_length_second}',
  'data.game_history[].participants[].{champion_name,position}',
  'data.game_history[].participants[].stats.{kill,death,assist,result,op_score}',
];

// Perfis já consultados nesta sessão (evita repetir chamadas remotas ao
// enriquecer uma composição inteira).
const cachePerfil = new Map<string, string>();

/** Perfil ranqueado (tier/LP/winrate + campeões mais jogados) via op.gg. */
export async function perfilInvocador(nickname: string, regiao = REGIAO_PADRAO): Promise<string> {
  const riotId = parseNickname(nickname);
  if (!riotId) {
    throw new Error(`Nickname "${nickname}" inválido — use o formato Nome#TAG (ex.: Faker#KR1).`);
  }
  const chave = `${regiao}:${riotId.gameName}#${riotId.tagLine}`;
  const emCache = cachePerfil.get(chave);
  if (emCache) return emCache;

  const texto = await chamarOpgg('lol_get_summoner_profile', {
    game_name: riotId.gameName,
    tag_line: riotId.tagLine,
    region: regiao,
    lang: 'pt_BR',
    desired_output_fields: CAMPOS_PERFIL,
  });
  cachePerfil.set(chave, texto);
  return texto;
}

/** Últimas partidas (KDA, campeão, resultado) via op.gg. */
export async function partidasRecentes(
  nickname: string,
  quantidade = 5,
  regiao = REGIAO_PADRAO
): Promise<string> {
  const riotId = parseNickname(nickname);
  if (!riotId) {
    throw new Error(`Nickname "${nickname}" inválido — use o formato Nome#TAG (ex.: Faker#KR1).`);
  }
  return chamarOpgg('lol_list_summoner_matches', {
    game_name: riotId.gameName,
    tag_line: riotId.tagLine,
    region: regiao,
    lang: 'pt_BR',
    limit: Math.min(20, Math.max(5, quantidade)),
    desired_output_fields: CAMPOS_PARTIDAS,
  });
}
