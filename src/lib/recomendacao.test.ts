import { describe, it, expect } from 'vitest';
import {
  isLane,
  encaixeNaVaga,
  melhorEncaixe,
  eloScore,
  formatarElo,
  rankearFreeAgents,
  rankearEquipes,
  type EloInfo,
  type AgenteBase,
  type EquipeBase,
} from '@/lib/recomendacao';

const elo = (tier: string, division: number | null = null, lp: number | null = 0): EloInfo => ({
  tier,
  division,
  lp,
  wins: null,
  losses: null,
});

const agente = (
  id: string,
  lanePrincipal: AgenteBase['lanePrincipal'],
  laneSecundaria: AgenteBase['laneSecundaria'] = null,
  createdAt = '2026-01-01T00:00:00Z'
): AgenteBase => ({ id, nickname: `${id}#BR1`, lanePrincipal, laneSecundaria, createdAt });

const equipe = (
  id: string,
  vagasLanes: EquipeBase['vagasLanes'],
  createdAt = '2026-01-01T00:00:00Z'
): EquipeBase => ({ id, nicknameCapitao: `cap-${id}#BR1`, vagasLanes, createdAt });

describe('isLane', () => {
  it('aceita lanes válidas e rejeita o resto', () => {
    expect(isLane('TOP')).toBe(true);
    expect(isLane('FILL')).toBe(true);
    expect(isLane('mid')).toBe(false);
    expect(isLane('')).toBe(false);
    expect(isLane(null)).toBe(false);
  });
});

describe('encaixeNaVaga', () => {
  it('principal > secundária > fill > nada (mesma regra do MCP)', () => {
    expect(encaixeNaVaga({ lanePrincipal: 'MID', laneSecundaria: 'TOP' }, 'MID')).toBe('PRINCIPAL');
    expect(encaixeNaVaga({ lanePrincipal: 'MID', laneSecundaria: 'TOP' }, 'TOP')).toBe('SECUNDARIA');
    expect(encaixeNaVaga({ lanePrincipal: 'FILL', laneSecundaria: null }, 'ADC')).toBe('FILL');
    expect(encaixeNaVaga({ lanePrincipal: 'MID', laneSecundaria: 'TOP' }, 'ADC')).toBeNull();
  });
});

describe('melhorEncaixe', () => {
  it('escolhe a vaga com melhor encaixe entre várias', () => {
    const jogador = { lanePrincipal: 'MID', laneSecundaria: 'TOP' } as const;
    expect(melhorEncaixe(jogador, ['TOP', 'MID'])).toEqual({ vaga: 'MID', encaixe: 'PRINCIPAL' });
    expect(melhorEncaixe(jogador, ['TOP', 'ADC'])).toEqual({ vaga: 'TOP', encaixe: 'SECUNDARIA' });
    expect(melhorEncaixe(jogador, ['ADC', 'SUPPORT'])).toBeNull();
  });

  it('fill encaixa em qualquer vaga', () => {
    expect(melhorEncaixe({ lanePrincipal: 'FILL', laneSecundaria: null }, ['ADC'])).toEqual({
      vaga: 'ADC',
      encaixe: 'FILL',
    });
  });

  it('ignora vagas duplicadas', () => {
    expect(
      melhorEncaixe({ lanePrincipal: 'MID', laneSecundaria: null }, ['MID', 'MID'])
    ).toEqual({ vaga: 'MID', encaixe: 'PRINCIPAL' });
  });
});

describe('eloScore', () => {
  it('ordena tiers e divisões na escala do jogo (400 por tier)', () => {
    expect(eloScore(elo('IRON', 4, 0))).toBe(0);
    expect(eloScore(elo('GOLD', 2, 45))).toBe(3 * 400 + 2 * 100 + 45);
    expect(eloScore(elo('CHALLENGER', null, 900))).toBe(9 * 400 + 900);
    expect(eloScore(elo('gold', 4, 0))).toBe(1200); // case-insensitive
  });

  it('devolve null para elo ausente ou tier desconhecido', () => {
    expect(eloScore(null)).toBeNull();
    expect(eloScore(undefined)).toBeNull();
    expect(eloScore(elo('WOOD', 4, 0))).toBeNull();
  });

  it('ignora a divisão em Mestre+ (o op.gg devolve 1, mas não existe divisão)', () => {
    expect(eloScore(elo('GRANDMASTER', 1, 1527))).toBe(8 * 400 + 1527);
    expect(eloScore(elo('MASTER', 1, 200))).toBe(7 * 400 + 200);
  });
});

describe('formatarElo', () => {
  it('traduz tier/divisão/LP para PT', () => {
    expect(formatarElo(elo('GOLD', 2, 45))).toBe('Ouro II · 45 LP');
    expect(formatarElo(elo('MASTER', null, 120))).toBe('Mestre · 120 LP');
    expect(formatarElo(elo('GRANDMASTER', 1, 1527))).toBe('Grão-Mestre · 1527 LP'); // divisão ignorada em Mestre+
    expect(formatarElo({ tier: 'SILVER', division: 1, lp: null, wins: null, losses: null })).toBe(
      'Prata I'
    );
  });

  it('devolve null para elo ausente ou tier desconhecido', () => {
    expect(formatarElo(null)).toBeNull();
    expect(formatarElo(elo('WOOD'))).toBeNull();
  });
});

describe('rankearFreeAgents', () => {
  it('filtra quem não encaixa e ordena por encaixe', () => {
    const agentes = [
      agente('fill', 'FILL'),
      agente('sec', 'TOP', 'MID'),
      agente('main', 'MID', 'TOP'),
      agente('fora', 'ADC', 'SUPPORT'),
    ];
    const r = rankearFreeAgents(agentes, ['MID']);
    expect(r.map((x) => x.agente.id)).toEqual(['main', 'sec', 'fill']);
    expect(r[0]).toMatchObject({ vaga: 'MID', encaixe: 'PRINCIPAL', elo: null });
  });

  it('desempata por elo (maior primeiro; sem elo por último) e depois antiguidade', () => {
    const agentes = [
      agente('velho-sem-elo', 'MID', 'TOP', '2026-01-01T00:00:00Z'),
      agente('ouro', 'MID', 'TOP', '2026-01-03T00:00:00Z'),
      agente('diamante', 'MID', 'TOP', '2026-01-04T00:00:00Z'),
    ];
    const elos = new Map<string, EloInfo | null>([
      ['ouro#BR1', elo('GOLD', 4, 10)],
      ['diamante#BR1', elo('DIAMOND', 4, 10)],
    ]);
    const r = rankearFreeAgents(agentes, ['MID'], elos);
    expect(r.map((x) => x.agente.id)).toEqual(['diamante', 'ouro', 'velho-sem-elo']);
  });

  it('sem elo nenhum, mantém a fila justa por createdAt', () => {
    const agentes = [
      agente('b', 'MID', null, '2026-01-02T00:00:00Z'),
      agente('a', 'MID', null, '2026-01-01T00:00:00Z'),
    ];
    expect(rankearFreeAgents(agentes, ['MID']).map((x) => x.agente.id)).toEqual(['a', 'b']);
  });

  it('elo não fura a hierarquia de encaixe (secundária forte ≺ principal fraca)', () => {
    const agentes = [agente('main-fraco', 'MID'), agente('sec-forte', 'TOP', 'MID')];
    const elos = new Map<string, EloInfo | null>([
      ['main-fraco#BR1', elo('IRON', 4, 0)],
      ['sec-forte#BR1', elo('CHALLENGER', null, 1000)],
    ]);
    const r = rankearFreeAgents(agentes, ['MID'], elos);
    expect(r.map((x) => x.agente.id)).toEqual(['main-fraco', 'sec-forte']);
  });
});

describe('rankearEquipes', () => {
  const jogador = { lanePrincipal: 'MID', laneSecundaria: 'TOP' } as const;

  it('filtra equipes sem vaga compatível e ordena por encaixe', () => {
    const equipes = [
      equipe('so-top', ['TOP']),
      equipe('com-mid', ['ADC', 'MID']),
      equipe('sem-nada', ['ADC', 'SUPPORT']),
    ];
    const r = rankearEquipes(equipes, jogador);
    expect(r.map((x) => x.equipe.id)).toEqual(['com-mid', 'so-top']);
    expect(r[0]).toMatchObject({ vaga: 'MID', encaixe: 'PRINCIPAL' });
    expect(r[1]).toMatchObject({ vaga: 'TOP', encaixe: 'SECUNDARIA' });
  });

  it('desempata por proximidade de elo com o capitão (time do seu nível primeiro)', () => {
    const equipes = [
      equipe('desafiante', ['MID'], '2026-01-01T00:00:00Z'),
      equipe('ouro', ['MID'], '2026-01-02T00:00:00Z'),
    ];
    const elosCapitaes = new Map<string, EloInfo | null>([
      ['cap-desafiante#BR1', elo('CHALLENGER', null, 800)],
      ['cap-ouro#BR1', elo('GOLD', 3, 50)],
    ]);
    const r = rankearEquipes(equipes, jogador, elo('GOLD', 4, 0), elosCapitaes);
    expect(r.map((x) => x.equipe.id)).toEqual(['ouro', 'desafiante']);
    expect(r[0].eloCapitao?.tier).toBe('GOLD');
  });

  it('capitão sem elo vai depois dos com elo; sem elo do jogador, vale a antiguidade', () => {
    const equipes = [
      equipe('sem-elo', ['MID'], '2026-01-01T00:00:00Z'),
      equipe('com-elo', ['MID'], '2026-01-02T00:00:00Z'),
    ];
    const elosCapitaes = new Map<string, EloInfo | null>([
      ['cap-com-elo#BR1', elo('GOLD', 4, 0)],
    ]);
    // Jogador com elo: capitão conhecido primeiro.
    const comElo = rankearEquipes(equipes, jogador, elo('GOLD', 4, 0), elosCapitaes);
    expect(comElo.map((x) => x.equipe.id)).toEqual(['com-elo', 'sem-elo']);
    // Sem o elo do jogador o critério é ignorado: equipe mais antiga primeiro.
    const semElo = rankearEquipes(equipes, jogador, null, elosCapitaes);
    expect(semElo.map((x) => x.equipe.id)).toEqual(['sem-elo', 'com-elo']);
  });
});
