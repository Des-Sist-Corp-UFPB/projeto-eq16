import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { equipe: { findMany: vi.fn() }, freeAgent: { findFirst: vi.fn() } },
}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/opgg', () => ({
  buscarElo: vi.fn(),
  buscarElos: vi.fn(),
  eloHabilitado: vi.fn(() => true),
}));

import { GET } from '@/app/api/recomendacoes/equipes/route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { buscarElo, buscarElos } from '@/lib/opgg';
import type { EloInfo } from '@/lib/recomendacao';

const equipeFindMany = vi.mocked(prisma.equipe.findMany);
const faFindFirst = vi.mocked(prisma.freeAgent.findFirst);
const sessao = vi.mocked(getServerSession);
const elo = vi.mocked(buscarElo);
const elos = vi.mocked(buscarElos);

const req = (qs = '') => new NextRequest(`http://x/api/recomendacoes/equipes${qs}`);

const equipeDb = (id: string, vagasLanes: string[], extras: Record<string, unknown> = {}) => ({
  id,
  nome: `Time ${id}`,
  nicknameCapitao: `cap-${id}#BR1`,
  vagasLanes,
  createdAt: new Date('2026-01-01'),
  userId: `dono-${id}`,
  user: { discordUsername: null },
  _count: { candidaturas: 0 },
  ...extras,
});

beforeEach(() => {
  vi.clearAllMocks();
  sessao.mockResolvedValue(null);
  elo.mockResolvedValue(null);
  elos.mockResolvedValue(new Map());
});

describe('GET /api/recomendacoes/equipes', () => {
  it('400 sem lane e sem sessão', async () => {
    expect((await GET(req())).status).toBe(400);
    expect(equipeFindMany).not.toHaveBeenCalled();
  });

  it('400 para lane inválida', async () => {
    expect((await GET(req('?lane=BOT'))).status).toBe(400);
    expect((await GET(req('?lane=MID&laneSecundaria=xx'))).status).toBe(400);
  });

  it('rankeia equipes pela rota informada (sem elo por padrão)', async () => {
    equipeFindMany.mockResolvedValue([
      equipeDb('sec', ['TOP']),
      equipeDb('main', ['MID', 'ADC']),
      equipeDb('fora', ['SUPPORT']),
    ] as never);

    const res = await GET(req('?lane=MID&laneSecundaria=TOP'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.equipes.map((e: { id: string }) => e.id)).toEqual(['main', 'sec']);
    expect(body.equipes[0]).toMatchObject({ vaga: 'MID', encaixe: 'PRINCIPAL', eloCapitao: null });
    expect(body.criterios).toMatchObject({ lane: 'MID', laneSecundaria: 'TOP', origem: 'PARAMS' });
    expect(elo).not.toHaveBeenCalled();
    expect(elos).not.toHaveBeenCalled();
  });

  it('com ?elo=1, enriquece e reordena por proximidade de elo do capitão', async () => {
    equipeFindMany.mockResolvedValue([
      equipeDb('desafiante', ['MID'], { createdAt: new Date('2026-01-01') }),
      equipeDb('ouro', ['MID'], { createdAt: new Date('2026-01-02') }),
    ] as never);
    const ouro = { tier: 'GOLD', division: 4, lp: 10, wins: null, losses: null };
    elo.mockResolvedValue({ ...ouro, lp: 0 }); // elo do jogador
    elos.mockResolvedValue(
      new Map<string, EloInfo | null>([
        ['cap-desafiante#BR1', { tier: 'CHALLENGER', division: null, lp: 900, wins: null, losses: null }],
        ['cap-ouro#BR1', ouro],
      ])
    );

    const body = await (await GET(req('?lane=MID&nickname=Eu%23BR1&elo=1'))).json();

    expect(elo).toHaveBeenCalledWith('Eu#BR1');
    expect(body.eloJogador).toMatchObject({ tier: 'GOLD' });
    expect(body.equipes.map((e: { id: string }) => e.id)).toEqual(['ouro', 'desafiante']);
    expect(body.equipes[0].eloCapitao).toMatchObject({ tier: 'GOLD' });
  });

  it('sem lane mas logado: usa o free agent do usuário e exclui equipes próprias/candidatadas', async () => {
    sessao.mockResolvedValue({ user: { id: 'u1' } } as never);
    faFindFirst.mockResolvedValue({
      nickname: 'Eu#BR1',
      lanePrincipal: 'MID',
      laneSecundaria: 'TOP',
    } as never);
    equipeFindMany.mockResolvedValue([equipeDb('a', ['MID'])] as never);

    const body = await (await GET(req())).json();

    expect(body.criterios).toMatchObject({ lane: 'MID', origem: 'CADASTRO', nickname: 'Eu#BR1' });
    expect(body.equipes).toHaveLength(1);
    const where = equipeFindMany.mock.calls[0]![0]!.where!;
    expect(where.NOT).toEqual({ userId: 'u1' });
    expect(where.candidaturas).toEqual({
      none: { userId: 'u1', status: { in: ['PENDENTE', 'ACEITA'] } },
    });
  });

  it('logado sem free agent: 200 com motivo SEM_CADASTRO (a aba se esconde)', async () => {
    sessao.mockResolvedValue({ user: { id: 'u1' } } as never);
    faFindFirst.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ equipes: [], motivo: 'SEM_CADASTRO' });
    expect(equipeFindMany).not.toHaveBeenCalled();
  });
});
