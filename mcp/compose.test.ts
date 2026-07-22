import { describe, it, expect } from 'vitest';
import {
  encaixeNaVaga,
  rankearCandidatos,
  sugerirComposicao,
  type FreeAgentDTO,
  type Lane,
} from './compose.ts';
import { parseNickname } from './opgg.ts';

let seq = 0;
function agente(
  nickname: string,
  lanePrincipal: Lane,
  laneSecundaria: Lane | null = null,
  createdAt?: string
): FreeAgentDTO {
  seq += 1;
  return {
    id: `fa-${seq}`,
    nickname,
    lanePrincipal,
    laneSecundaria,
    discordUsername: `${nickname.split('#')[0]}#disc`,
    createdAt: createdAt ?? `2026-07-0${Math.min(9, seq)}T00:00:00.000Z`,
    userId: `u-${seq}`,
  };
}

describe('encaixeNaVaga', () => {
  it('classifica principal, secundária e fill', () => {
    const a = agente('A#TAG', 'MID', 'TOP');
    expect(encaixeNaVaga(a, 'MID')).toBe('PRINCIPAL');
    expect(encaixeNaVaga(a, 'TOP')).toBe('SECUNDARIA');
    expect(encaixeNaVaga(a, 'ADC')).toBeNull();
  });

  it('fill como principal atende qualquer vaga', () => {
    const fill = agente('F#TAG', 'FILL');
    for (const vaga of ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'] as Lane[]) {
      expect(encaixeNaVaga(fill, vaga)).toBe('FILL');
    }
  });
});

describe('rankearCandidatos', () => {
  it('ordena principal > secundária > fill', () => {
    const agentes = [
      agente('Fill#1', 'FILL'),
      agente('Sec#1', 'TOP', 'MID'),
      agente('Main#1', 'MID', 'ADC'),
    ];
    const ranking = rankearCandidatos(agentes, 'MID');
    expect(ranking.map((c) => c.nickname)).toEqual(['Main#1', 'Sec#1', 'Fill#1']);
    expect(ranking[0].encaixe).toBe('PRINCIPAL');
  });

  it('desempata pela ordem de cadastro (fila justa)', () => {
    const antigo = agente('Antigo#1', 'ADC', null, '2026-07-01T00:00:00.000Z');
    const novo = agente('Novo#1', 'ADC', null, '2026-07-05T00:00:00.000Z');
    const ranking = rankearCandidatos([novo, antigo], 'ADC');
    expect(ranking.map((c) => c.nickname)).toEqual(['Antigo#1', 'Novo#1']);
  });

  it('exclui quem não atende a vaga', () => {
    const ranking = rankearCandidatos([agente('Top#1', 'TOP', 'JUNGLE')], 'SUPPORT');
    expect(ranking).toHaveLength(0);
  });
});

describe('sugerirComposicao', () => {
  it('escala sem repetir jogador', () => {
    const versatil = agente('Versatil#1', 'MID', 'ADC', '2026-07-01T00:00:00.000Z');
    const soAdc = agente('SoAdc#1', 'ADC', null, '2026-07-02T00:00:00.000Z');
    const comp = sugerirComposicao(['MID', 'ADC'], [versatil, soAdc]);

    const escalados = comp.escalacao.map((e) => e.candidato?.nickname);
    expect(escalados).toContain('Versatil#1');
    expect(escalados).toContain('SoAdc#1');
    expect(new Set(escalados).size).toBe(2);
  });

  it('vaga mais escassa escolhe primeiro (versátil não rouba a única opção)', () => {
    // Versátil é o ÚNICO candidato de SUPPORT, mas também joga MID (onde há outro).
    const versatil = agente('Versatil#1', 'SUPPORT', 'MID', '2026-07-01T00:00:00.000Z');
    const midLaner = agente('Mid#1', 'MID', null, '2026-07-02T00:00:00.000Z');
    const comp = sugerirComposicao(['MID', 'SUPPORT'], [versatil, midLaner]);

    const porVaga = Object.fromEntries(comp.escalacao.map((e) => [e.vaga, e.candidato?.nickname]));
    expect(porVaga.SUPPORT).toBe('Versatil#1');
    expect(porVaga.MID).toBe('Mid#1');
  });

  it('reporta vagas sem candidato', () => {
    const comp = sugerirComposicao(['TOP', 'JUNGLE'], [agente('Top#1', 'TOP')]);
    expect(comp.vagasSemCandidato).toEqual(['JUNGLE']);
    const jungle = comp.escalacao.find((e) => e.vaga === 'JUNGLE');
    expect(jungle?.candidato).toBeNull();
  });

  it('respeita maxPorVaga na listagem, mas escala considerando todos', () => {
    const agentes = [
      agente('A#1', 'MID'),
      agente('B#1', 'MID'),
      agente('C#1', 'MID'),
      agente('D#1', 'MID'),
    ];
    const comp = sugerirComposicao(['MID'], agentes, 2);
    expect(comp.candidatosPorVaga[0].candidatos).toHaveLength(2);
  });

  it('suporta vagas duplicadas da mesma lane (equipe com 2 slots de MID)', () => {
    const agentes = [agente('A#1', 'MID'), agente('B#1', 'MID')];
    const comp = sugerirComposicao(['MID', 'MID'], agentes);
    const escalados = comp.escalacao.map((e) => e.candidato?.nickname);
    expect(new Set(escalados).size).toBe(2);
  });
});

describe('parseNickname (formato do site → Riot ID do op.gg)', () => {
  it('separa nome e tag', () => {
    expect(parseNickname('Chico kit lasca#Chico')).toEqual({
      gameName: 'Chico kit lasca',
      tagLine: 'Chico',
    });
  });

  it('rejeita formatos inválidos', () => {
    expect(parseNickname('SemTag')).toBeNull();
    expect(parseNickname('Nome#TAGGIGANTE')).toBeNull();
    expect(parseNickname('Nome#')).toBeNull();
  });

  it('aceita espaços ao redor', () => {
    expect(parseNickname('  Faker#KR1  ')).toEqual({ gameName: 'Faker', tagLine: 'KR1' });
  });
});
