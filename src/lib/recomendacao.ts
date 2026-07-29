import type { Lane } from '@/types';

/**
 * Lógica pura de recomendação (equipes ⇄ free agents).
 *
 * Mesmo espírito de `mcp/compose.ts`, mas voltada ao usuário final do site:
 * dado o cadastro de um jogador (rotas + nick) ou as vagas de uma equipe,
 * rankeia os candidatos da nossa própria base. Nenhuma IA envolvida — o
 * ranking é determinístico:
 *
 *   1. Encaixe de rota (principal > secundária > fill);
 *   2. Elo (quando disponível via op.gg — ver `src/lib/opgg.ts`);
 *   3. Antiguidade do cadastro (fila justa).
 *
 * Módulo sem dependência de banco/rede para ser testável por unidade e
 * importável tanto no servidor quanto em componentes client (formatação).
 */

export const LANES: Lane[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FILL'];

/** Valida um valor vindo de query string como Lane. */
export function isLane(valor: string | null | undefined): valor is Lane {
  return !!valor && (LANES as string[]).includes(valor);
}

/** Como o candidato atende a vaga — usado no ranking (PRINCIPAL vence). */
export type Encaixe = 'PRINCIPAL' | 'SECUNDARIA' | 'FILL';

export const PESO_ENCAIXE: Record<Encaixe, number> = {
  PRINCIPAL: 0,
  SECUNDARIA: 1,
  FILL: 2,
};

export const ROTULO_ENCAIXE: Record<Encaixe, string> = {
  PRINCIPAL: 'Rota principal',
  SECUNDARIA: 'Rota secundária',
  FILL: 'Fill',
};

/** Rotas de um jogador (free agent ou candidato). */
export interface RotasJogador {
  lanePrincipal: Lane;
  laneSecundaria: Lane | null;
}

/** Diz como (e se) um jogador atende uma vaga — mesma regra de `mcp/compose.ts`. */
export function encaixeNaVaga(jogador: RotasJogador, vaga: Lane): Encaixe | null {
  if (jogador.lanePrincipal === vaga) return 'PRINCIPAL';
  if (jogador.laneSecundaria === vaga) return 'SECUNDARIA';
  // Fill como principal joga qualquer rota (regra do produto).
  if (jogador.lanePrincipal === 'FILL') return 'FILL';
  return null;
}

/** Melhor encaixe do jogador dentre um conjunto de vagas (ou null se nenhuma serve). */
export function melhorEncaixe(
  jogador: RotasJogador,
  vagas: Lane[]
): { vaga: Lane; encaixe: Encaixe } | null {
  let melhor: { vaga: Lane; encaixe: Encaixe } | null = null;
  for (const vaga of new Set(vagas)) {
    const encaixe = encaixeNaVaga(jogador, vaga);
    if (encaixe && (!melhor || PESO_ENCAIXE[encaixe] < PESO_ENCAIXE[melhor.encaixe])) {
      melhor = { vaga, encaixe };
    }
  }
  return melhor;
}

// ─── Elo (dados do op.gg — ver src/lib/opgg.ts) ──────────────────────────────

/** Elo ranqueado de um invocador (shape estruturado extraído do op.gg). */
export interface EloInfo {
  /** Tier em inglês/maiúsculas, como o op.gg devolve (ex.: "GOLD"). */
  tier: string;
  /** Divisão 1..4 (null para Mestre+). */
  division: number | null;
  lp: number | null;
  wins: number | null;
  losses: number | null;
}

/** Ordem crescente de força dos tiers. */
const ORDEM_TIERS = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
];

const NOME_TIER_PT: Record<string, string> = {
  IRON: 'Ferro',
  BRONZE: 'Bronze',
  SILVER: 'Prata',
  GOLD: 'Ouro',
  PLATINUM: 'Platina',
  EMERALD: 'Esmeralda',
  DIAMOND: 'Diamante',
  MASTER: 'Mestre',
  GRANDMASTER: 'Grão-Mestre',
  CHALLENGER: 'Desafiante',
};

const DIVISAO_ROMANA: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

/** Mestre+ não tem divisões de verdade (o op.gg devolve 1) — ignoramos. */
const TIERS_SEM_DIVISAO = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);

function divisaoEfetiva(tier: string, division: number | null): number | null {
  return TIERS_SEM_DIVISAO.has(tier) ? null : division;
}

/**
 * Pontuação comparável de um elo (maior = mais forte); null se desconhecido.
 * Cada tier vale 400 (4 divisões × 100 LP), como a escala real do jogo.
 */
export function eloScore(elo: EloInfo | null | undefined): number | null {
  if (!elo) return null;
  const tier = ORDEM_TIERS.indexOf(elo.tier.toUpperCase());
  if (tier < 0) return null;
  const division = divisaoEfetiva(elo.tier.toUpperCase(), elo.division);
  const divisao = division ? 4 - division : 0; // IV=0 … I=3
  return tier * 400 + divisao * 100 + (elo.lp ?? 0);
}

/** "GOLD 2, 45lp" -> "Ouro II · 45 LP" (null se o tier for desconhecido). */
export function formatarElo(elo: EloInfo | null | undefined): string | null {
  if (!elo) return null;
  const tierMaiusculo = elo.tier.toUpperCase();
  const nome = NOME_TIER_PT[tierMaiusculo];
  if (!nome) return null;
  const division = divisaoEfetiva(tierMaiusculo, elo.division);
  const divisao = division ? DIVISAO_ROMANA[division] : null;
  const base = divisao ? `${nome} ${divisao}` : nome;
  return elo.lp == null ? base : `${base} · ${elo.lp} LP`;
}

// ─── Ranking de free agents para um conjunto de vagas ────────────────────────

/** Campos mínimos de um free agent para o ranking. */
export interface AgenteBase extends RotasJogador {
  id: string;
  nickname: string;
  createdAt: string | Date;
}

export interface AgenteRecomendado<T extends AgenteBase> {
  agente: T;
  /** Vaga em que o agente melhor se encaixa. */
  vaga: Lane;
  encaixe: Encaixe;
  elo: EloInfo | null;
}

function tempo(v: string | Date): number {
  return new Date(v).getTime();
}

/**
 * Rankeia free agents para as vagas dadas: encaixe > elo (desconhecido por
 * último dentro do mesmo encaixe) > antiguidade do cadastro.
 */
export function rankearFreeAgents<T extends AgenteBase>(
  agentes: T[],
  vagas: Lane[],
  elos?: Map<string, EloInfo | null>
): AgenteRecomendado<T>[] {
  return agentes
    .map((agente) => ({ agente, fit: melhorEncaixe(agente, vagas) }))
    .filter((x): x is { agente: T; fit: { vaga: Lane; encaixe: Encaixe } } => x.fit !== null)
    .map(({ agente, fit }) => ({
      agente,
      vaga: fit.vaga,
      encaixe: fit.encaixe,
      elo: elos?.get(agente.nickname) ?? null,
    }))
    .sort((a, b) => {
      const peso = PESO_ENCAIXE[a.encaixe] - PESO_ENCAIXE[b.encaixe];
      if (peso !== 0) return peso;
      const scoreA = eloScore(a.elo);
      const scoreB = eloScore(b.elo);
      if (scoreA !== null || scoreB !== null) {
        if (scoreA === null) return 1; // elo conhecido vence o desconhecido
        if (scoreB === null) return -1;
        if (scoreA !== scoreB) return scoreB - scoreA; // maior elo primeiro
      }
      return tempo(a.agente.createdAt) - tempo(b.agente.createdAt); // fila justa
    });
}

// ─── Ranking de equipes para um jogador ──────────────────────────────────────

/** Campos mínimos de uma equipe para o ranking. */
export interface EquipeBase {
  id: string;
  nicknameCapitao: string;
  vagasLanes: Lane[];
  createdAt: string | Date;
}

export interface EquipeRecomendada<T extends EquipeBase> {
  equipe: T;
  /** Vaga da equipe que o jogador preencheria. */
  vaga: Lane;
  encaixe: Encaixe;
  eloCapitao: EloInfo | null;
}

/**
 * Rankeia equipes para um jogador: encaixe de rota > proximidade de elo entre
 * jogador e capitão (times do seu nível primeiro; sem elo dos dois lados o
 * critério é ignorado) > equipe mais antiga (espera há mais tempo).
 */
export function rankearEquipes<T extends EquipeBase>(
  equipes: T[],
  jogador: RotasJogador,
  eloJogador?: EloInfo | null,
  elosCapitaes?: Map<string, EloInfo | null>
): EquipeRecomendada<T>[] {
  const scoreJogador = eloScore(eloJogador);

  const proximidade = (eloCapitao: EloInfo | null): number => {
    const scoreCapitao = eloScore(eloCapitao);
    if (scoreJogador === null || scoreCapitao === null) return Number.POSITIVE_INFINITY;
    return Math.abs(scoreCapitao - scoreJogador);
  };

  return equipes
    .map((equipe) => ({ equipe, fit: melhorEncaixe(jogador, equipe.vagasLanes) }))
    .filter((x): x is { equipe: T; fit: { vaga: Lane; encaixe: Encaixe } } => x.fit !== null)
    .map(({ equipe, fit }) => ({
      equipe,
      vaga: fit.vaga,
      encaixe: fit.encaixe,
      eloCapitao: elosCapitaes?.get(equipe.nicknameCapitao) ?? null,
    }))
    .sort((a, b) => {
      const peso = PESO_ENCAIXE[a.encaixe] - PESO_ENCAIXE[b.encaixe];
      if (peso !== 0) return peso;
      const proxA = proximidade(a.eloCapitao);
      const proxB = proximidade(b.eloCapitao);
      if (proxA !== proxB) return proxA - proxB;
      return tempo(a.equipe.createdAt) - tempo(b.equipe.createdAt);
    });
}
