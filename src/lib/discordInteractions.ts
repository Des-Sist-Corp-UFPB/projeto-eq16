import { createPublicKey, verify } from 'crypto';
import { prisma } from './prisma';
import { aceitarCandidatura, recusarCandidatura, CandidaturaError } from './candidaturas';
import { logAudit, AuditAction } from './audit';

/**
 * Interactions Endpoint do Discord (serverless, sem bot 24/7).
 *
 * O Discord faz um `POST` nesta rota a cada clique de botão / comando. Aqui mora
 * a lógica PURA (verificação de assinatura + roteamento), separada da "casca" HTTP
 * (a Route Handler) para ficar testável sem subir servidor.
 *
 * Fonte da verdade continua no nosso banco: o Discord só PEDE a mudança; quem decide
 * é `src/lib/candidaturas.ts` (mesmo núcleo usado pelo site).
 */

// https://discord.com/developers/docs/interactions/receiving-and-responding
export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
} as const;

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  UPDATE_MESSAGE: 7,
} as const;

const EPHEMERAL = 1 << 6; // 64 — mensagem visível só para quem clicou

// Estilos de botão do Discord.
const BUTTON_STYLE = { SUCCESS: 3, DANGER: 4 } as const;
const COMPONENT_TYPE = { ACTION_ROW: 1, BUTTON: 2 } as const;

/** Prefixo do `custom_id` dos botões do painel de candidatura. */
export const CANDIDATURA_PANEL_PREFIX = 'cand';

// ─── Verificação de assinatura (Ed25519, sem dependências) ───────────────────

// Cabeçalho DER (SPKI) de uma chave pública Ed25519, ao qual concatenamos os 32
// bytes da chave crua para montar um KeyObject sem libs externas.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * Valida a assinatura `X-Signature-Ed25519` de uma interação.
 * A mensagem assinada pelo Discord é `timestamp + corpo_cru` (bytes exatos).
 * Retorna `false` em qualquer entrada inválida (nunca lança).
 */
export function verifyInteractionSignature(opts: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  publicKey?: string;
}): boolean {
  const publicKey = opts.publicKey ?? process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey || !opts.signature || !opts.timestamp) return false;

  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey, 'hex')]),
      format: 'der',
      type: 'spki',
    });
    return verify(
      null,
      Buffer.from(opts.timestamp + opts.rawBody),
      key,
      Buffer.from(opts.signature, 'hex')
    );
  } catch {
    return false;
  }
}

// ─── Construção do painel de botões ──────────────────────────────────────────

/** Action row com os botões Aceitar/Recusar de uma candidatura (para o bot postar). */
export function buildCandidaturaButtons(candidaturaId: string) {
  return [
    {
      type: COMPONENT_TYPE.ACTION_ROW,
      components: [
        {
          type: COMPONENT_TYPE.BUTTON,
          style: BUTTON_STYLE.SUCCESS,
          label: 'Aceitar',
          custom_id: `${CANDIDATURA_PANEL_PREFIX}:aceitar:${candidaturaId}`,
        },
        {
          type: COMPONENT_TYPE.BUTTON,
          style: BUTTON_STYLE.DANGER,
          label: 'Recusar',
          custom_id: `${CANDIDATURA_PANEL_PREFIX}:recusar:${candidaturaId}`,
        },
      ],
    },
  ];
}

// ─── Roteamento das interações ───────────────────────────────────────────────

export interface DiscordInteraction {
  type: number;
  data?: { custom_id?: string };
  member?: { user?: { id?: string } }; // interações em servidor
  user?: { user?: { id?: string }; id?: string }; // interações em DM (fallback)
}

interface InteractionResponse {
  type: number;
  data?: { content?: string; flags?: number; components?: unknown[] };
}

function mensagemEfemera(content: string): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: EPHEMERAL },
  };
}

function atualizaPainel(content: string): InteractionResponse {
  // Substitui o painel pelo resultado e remove os botões (não dá pra clicar de novo).
  return { type: InteractionResponseType.UPDATE_MESSAGE, data: { content, components: [] } };
}

/**
 * Processa uma interação já validada e devolve o objeto de resposta do Discord.
 * (A verificação de assinatura acontece antes, na Route Handler.)
 */
export async function handleInteraction(interaction: DiscordInteraction): Promise<InteractionResponse> {
  if (interaction.type === InteractionType.PING) {
    return { type: InteractionResponseType.PONG };
  }
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    return handleComponent(interaction);
  }
  return mensagemEfemera('Interação não suportada. Use os botões do painel da equipe.');
}

async function handleComponent(interaction: DiscordInteraction): Promise<InteractionResponse> {
  const [prefix, acao, candidaturaId] = (interaction.data?.custom_id ?? '').split(':');
  if (prefix !== CANDIDATURA_PANEL_PREFIX || !candidaturaId || (acao !== 'aceitar' && acao !== 'recusar')) {
    return mensagemEfemera('Ação desconhecida.');
  }

  const clickerDiscordId = interaction.member?.user?.id ?? interaction.user?.user?.id ?? interaction.user?.id;
  if (!clickerDiscordId) {
    return mensagemEfemera('Não consegui identificar quem clicou.');
  }

  // Resolve a identidade no nosso banco (discordId → User). A regra de "é o capitão?"
  // é garantida lá dentro por aceitar/recusarCandidatura (assertCapitao).
  const ator = await prisma.user.findUnique({
    where: { discordId: clickerDiscordId },
    select: { id: true, username: true, role: true },
  });
  if (!ator) {
    return mensagemEfemera('Sua conta do Discord não está vinculada no site.');
  }
  const isAdmin = ator.role === 'ADMIN';

  try {
    if (acao === 'aceitar') {
      const resultado = await aceitarCandidatura(candidaturaId, ator.id, isAdmin);
      await logAudit({
        action: AuditAction.CANDIDATURA_ACCEPT,
        actorId: ator.id,
        actorLabel: ator.username,
        targetType: 'Candidatura',
        targetId: candidaturaId,
        metadata: { ...resultado, via: 'discord' },
      });
      return atualizaPainel('✅ Candidatura aceita!');
    }

    const resultado = await recusarCandidatura(candidaturaId, ator.id, isAdmin);
    await logAudit({
      action: AuditAction.CANDIDATURA_REJECT,
      actorId: ator.id,
      actorLabel: ator.username,
      targetType: 'Candidatura',
      targetId: candidaturaId,
      metadata: { ...resultado, via: 'discord' },
    });
    return atualizaPainel('❌ Candidatura recusada.');
  } catch (e) {
    if (e instanceof CandidaturaError) {
      return mensagemEfemera(`⚠️ ${e.message}`);
    }
    return mensagemEfemera('Erro ao processar a ação.');
  }
}
