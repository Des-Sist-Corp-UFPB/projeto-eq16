/**
 * Lógica pura de sugestão de composição de time.
 *
 * Separada do servidor MCP para ser testável por unidade (sem rede):
 * recebe as vagas abertas e a lista de free agents e devolve, para cada vaga,
 * os candidatos rankeados + uma escalação sugerida sem repetir jogador.
 */

export const LANES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FILL'] as const;
export type Lane = (typeof LANES)[number];

/** Shape retornado por GET /api/free-agents (o que o front já consome). */
export interface FreeAgentDTO {
  id: string;
  nickname: string;
  lanePrincipal: Lane;
  laneSecundaria: Lane | null;
  discordUsername: string | null;
  createdAt: string;
  userId: string;
}

/** Como o candidato atende a vaga — usado no ranking (PRINCIPAL vence). */
export type Encaixe = 'PRINCIPAL' | 'SECUNDARIA' | 'FILL';

export interface Candidato {
  freeAgentId: string;
  nickname: string;
  discordUsername: string | null;
  encaixe: Encaixe;
}

export interface Composicao {
  /** Candidatos rankeados por vaga (na ordem das vagas pedidas). */
  candidatosPorVaga: { vaga: Lane; candidatos: Candidato[] }[];
  /** Escalação sugerida: no máximo 1 jogador por vaga, sem repetir jogador. */
  escalacao: { vaga: Lane; candidato: Candidato | null }[];
  /** Vagas para as quais não há nenhum candidato disponível. */
  vagasSemCandidato: Lane[];
}

const PESO_ENCAIXE: Record<Encaixe, number> = {
  PRINCIPAL: 0,
  SECUNDARIA: 1,
  FILL: 2,
};

/** Diz como (e se) um free agent atende uma vaga. */
export function encaixeNaVaga(agente: FreeAgentDTO, vaga: Lane): Encaixe | null {
  if (agente.lanePrincipal === vaga) return 'PRINCIPAL';
  if (agente.laneSecundaria === vaga) return 'SECUNDARIA';
  // Fill como principal joga qualquer rota (regra do produto).
  if (agente.lanePrincipal === 'FILL') return 'FILL';
  return null;
}

/**
 * Ranking de candidatos para UMA vaga: lane principal > secundária > fill;
 * empate resolvido por antiguidade do anúncio (fila justa).
 */
export function rankearCandidatos(agentes: FreeAgentDTO[], vaga: Lane): Candidato[] {
  return agentes
    .map((a) => ({ agente: a, encaixe: encaixeNaVaga(a, vaga) }))
    .filter((x): x is { agente: FreeAgentDTO; encaixe: Encaixe } => x.encaixe !== null)
    .sort((a, b) => {
      const peso = PESO_ENCAIXE[a.encaixe] - PESO_ENCAIXE[b.encaixe];
      if (peso !== 0) return peso;
      return a.agente.createdAt.localeCompare(b.agente.createdAt);
    })
    .map(({ agente, encaixe }) => ({
      freeAgentId: agente.id,
      nickname: agente.nickname,
      discordUsername: agente.discordUsername,
      encaixe,
    }));
}

/**
 * Monta a composição para um conjunto de vagas.
 *
 * A escalação é gulosa começando pelas vagas mais escassas (menos candidatos):
 * assim um jogador versátil não "rouba" a única opção de outra vaga.
 * `maxPorVaga` limita a lista de candidatos exibida por vaga (a escalação
 * considera todos).
 */
export function sugerirComposicao(
  vagas: Lane[],
  agentes: FreeAgentDTO[],
  maxPorVaga = 3
): Composicao {
  const ranking = vagas.map((vaga) => ({ vaga, candidatos: rankearCandidatos(agentes, vaga) }));

  // Escalação: vagas mais escassas escolhem primeiro; cada jogador entra 1x.
  const usados = new Set<string>();
  const escolhaPorIndice = new Map<number, Candidato | null>();
  const porEscassez = ranking
    .map((r, indice) => ({ ...r, indice }))
    .sort((a, b) => a.candidatos.length - b.candidatos.length);

  for (const { candidatos, indice } of porEscassez) {
    const escolhido = candidatos.find((c) => !usados.has(c.freeAgentId)) ?? null;
    if (escolhido) usados.add(escolhido.freeAgentId);
    escolhaPorIndice.set(indice, escolhido);
  }

  return {
    candidatosPorVaga: ranking.map(({ vaga, candidatos }) => ({
      vaga,
      candidatos: candidatos.slice(0, maxPorVaga),
    })),
    escalacao: ranking.map(({ vaga }, i) => ({ vaga, candidato: escolhaPorIndice.get(i) ?? null })),
    vagasSemCandidato: ranking.filter((r) => r.candidatos.length === 0).map((r) => r.vaga),
  };
}
