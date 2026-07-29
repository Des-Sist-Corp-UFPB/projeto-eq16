import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    freeAgent: { findMany: vi.fn() },
    equipe: { findFirst: vi.fn() },
    candidatura: { findMany: vi.fn() },
  },
}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/opgg', () => ({
  buscarElos: vi.fn(),
  eloHabilitado: vi.fn(() => true),
}));

import { GET } from '@/app/api/recomendacoes/free-agents/route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { buscarElos } from '@/lib/opgg';

const faFindMany = vi.mocked(prisma.freeAgent.findMany);
const equipeFindFirst = vi.mocked(prisma.equipe.findFirst);
const candFindMany = vi.mocked(prisma.candidatura.findMany);
const sessao = vi.mocked(getServerSession);
const elos = vi.mocked(buscarElos);

const req = (qs = '') => new NextRequest(`http://x/api/recomendacoes/free-agents${qs}`);

const agenteDb = (
  id: string,
  lanePrincipal: string,
  laneSecundaria: string | null = null,
  extras: Record<string, unknown> = {}
) => ({
  id,
  nickname: `${id}#BR1`,
  lanePrincipal,
  laneSecundaria,
  createdAt: new Date('2026-01-01'),
  userId: `dono-${id}`,
  user: { discordUsername: null },
  ...extras,
});

beforeEach(() => {
  vi.clearAllMocks();
  sessao.mockResolvedValue(null);
  elos.mockResolvedValue(new Map());
  candFindMany.mockResolvedValue([] as never);
});

describe('GET /api/recomendacoes/free-agents', () => {
  it('400 sem lanes e sem sessão', async () => {
    expect((await GET(req())).status).toBe(400);
    expect(faFindMany).not.toHaveBeenCalled();
  });

  it('400 para lane inválida na lista', async () => {
    expect((await GET(req('?lanes=MID,BOT'))).status).toBe(400);
  });

  it('rankeia free agents para as vagas (principal > secundária > fill)', async () => {
    faFindMany.mockResolvedValue([
      agenteDb('fill', 'FILL'),
      agenteDb('sec', 'TOP', 'MID'),
      agenteDb('main', 'MID', 'TOP'),
      agenteDb('fora', 'ADC', 'SUPPORT'),
    ] as never);

    const res = await GET(req('?lanes=MID'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.freeAgents.map((f: { id: string }) => f.id)).toEqual(['main', 'sec', 'fill']);
    expect(body.freeAgents[0]).toMatchObject({ vaga: 'MID', encaixe: 'PRINCIPAL', elo: null });
    expect(body.criterios).toMatchObject({ lanes: ['MID'], origem: 'PARAMS' });
    expect(elos).not.toHaveBeenCalled();
  });

  it('com ?elo=1, enriquece e reordena por elo dentro do mesmo encaixe', async () => {
    faFindMany.mockResolvedValue([
      agenteDb('ouro', 'MID', null, { createdAt: new Date('2026-01-01') }),
      agenteDb('diamante', 'MID', null, { createdAt: new Date('2026-01-02') }),
    ] as never);
    elos.mockResolvedValue(
      new Map([
        ['ouro#BR1', { tier: 'GOLD', division: 4, lp: 10, wins: null, losses: null }],
        ['diamante#BR1', { tier: 'DIAMOND', division: 4, lp: 10, wins: null, losses: null }],
      ])
    );

    const body = await (await GET(req('?lanes=MID&elo=1'))).json();

    expect(elos).toHaveBeenCalledWith(['ouro#BR1', 'diamante#BR1'], 6);
    expect(body.freeAgents.map((f: { id: string }) => f.id)).toEqual(['diamante', 'ouro']);
    expect(body.freeAgents[0].elo).toMatchObject({ tier: 'DIAMOND' });
  });

  it('sem lanes mas logado: usa as vagas da equipe aberta do usuário e exclui o próprio FA', async () => {
    sessao.mockResolvedValue({ user: { id: 'u1' } } as never);
    equipeFindFirst.mockResolvedValue({ id: 'eq1', nome: 'Meu Time', vagasLanes: ['ADC'] } as never);
    faFindMany.mockResolvedValue([agenteDb('a', 'ADC')] as never);

    const body = await (await GET(req())).json();

    expect(body.criterios).toMatchObject({
      lanes: ['ADC'],
      origem: 'CADASTRO',
      equipeNome: 'Meu Time',
      equipeId: 'eq1', // é o que habilita o botão "Convidar" na UI
    });
    expect(body.freeAgents).toHaveLength(1);
    expect(faFindMany.mock.calls[0]![0]!.where).toEqual({ NOT: { userId: 'u1' } });
  });

  it('marca o convite já enviado para a vaga (a UI mostra "Convidado" no lugar do botão)', async () => {
    sessao.mockResolvedValue({ user: { id: 'u1' } } as never);
    equipeFindFirst.mockResolvedValue({ id: 'eq1', nome: 'Meu Time', vagasLanes: ['ADC'] } as never);
    faFindMany.mockResolvedValue([agenteDb('a', 'ADC'), agenteDb('b', 'ADC')] as never);
    candFindMany.mockResolvedValue([
      { userId: 'dono-a', lane: 'ADC', status: 'PENDENTE' },
      { userId: 'dono-b', lane: 'MID', status: 'ACEITA' }, // outra vaga: não conta
    ] as never);

    const body = await (await GET(req())).json();

    expect(candFindMany).toHaveBeenCalledWith({
      where: { equipeId: 'eq1', userId: { in: ['dono-a', 'dono-b'] } },
      select: { userId: true, lane: true, status: true },
    });
    expect(body.freeAgents[0]).toMatchObject({ id: 'a', convite: 'PENDENTE' });
    expect(body.freeAgents[1]).toMatchObject({ id: 'b', convite: null });
  });

  it('sem equipe conhecida (modal), não consulta convites e devolve equipeId null', async () => {
    faFindMany.mockResolvedValue([agenteDb('a', 'MID')] as never);
    const body = await (await GET(req('?lanes=MID'))).json();
    expect(candFindMany).not.toHaveBeenCalled();
    expect(body.criterios.equipeId).toBeNull();
    expect(body.freeAgents[0].convite).toBeNull();
  });

  it('logado sem equipe aberta: 200 com motivo SEM_CADASTRO (a aba se esconde)', async () => {
    sessao.mockResolvedValue({ user: { id: 'u1' } } as never);
    equipeFindFirst.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ freeAgents: [], motivo: 'SEM_CADASTRO' });
    expect(faFindMany).not.toHaveBeenCalled();
  });

  it('deduplica lanes repetidas na query', async () => {
    faFindMany.mockResolvedValue([agenteDb('a', 'MID')] as never);
    const body = await (await GET(req('?lanes=MID,MID'))).json();
    expect(body.criterios.lanes).toEqual(['MID']);
  });
});
