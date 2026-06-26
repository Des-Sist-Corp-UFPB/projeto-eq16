import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    equipe: { findUnique: vi.fn() },
    candidatura: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));
vi.mock('@/lib/discord', () => ({ addMemberToChannel: vi.fn(), postChannelMessage: vi.fn() }));
vi.mock('@/lib/discordInteractions', () => ({ buildCandidaturaButtons: vi.fn(() => [{ type: 1 }]) }));
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  requestMeta: () => ({ ip: null, userAgent: null }),
  AuditAction: { CANDIDATURA_CREATE: 'candidatura.create' },
}));

import { GET, POST } from '@/app/api/equipes/[id]/solicitar/route';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { addMemberToChannel, postChannelMessage } from '@/lib/discord';
import { logAudit } from '@/lib/audit';

const userFind = vi.mocked(prisma.user.findUnique);
const equipeFind = vi.mocked(prisma.equipe.findUnique);
const candFindMany = vi.mocked(prisma.candidatura.findMany);
const candFindUnique = vi.mocked(prisma.candidatura.findUnique);
const candCreate = vi.mocked(prisma.candidatura.create);
const getSession = vi.mocked(getSessionOrUnauthorized);
const addMember = vi.mocked(addMemberToChannel);
const postMsg = vi.mocked(postChannelMessage);

const ctx = { params: Promise.resolve({ id: 'e1' }) };
const req = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as never;
function sessao(id = 'u1') {
  getSession.mockResolvedValue({ session: { user: { id, username: 'Player', role: 'USER' } }, error: null } as never);
}
/** logado + discord vinculado, equipe aberta com vaga TOP de outro capitão. */
function cenarioBase(equipeOverrides = {}) {
  sessao('u1');
  userFind.mockResolvedValue({ discordId: 'd1', discordUsername: 'Player' } as never);
  equipeFind.mockResolvedValue({ id: 'e1', nome: 'Time', userId: 'cap', vagasLanes: ['TOP'], discordChannelId: null, ...equipeOverrides } as never);
  candFindMany.mockResolvedValue([] as never);
  candFindUnique.mockResolvedValue(null);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/equipes/[id]/solicitar', () => {
  it('retorna as candidaturas do usuário', async () => {
    sessao();
    candFindMany.mockResolvedValue([{ lane: 'TOP', status: 'PENDENTE' }] as never);
    const body = await (await GET(req({}), ctx)).json();
    expect(body.candidaturas).toHaveLength(1);
  });
});

describe('POST /api/equipes/[id]/solicitar', () => {
  it('repassa 401', async () => {
    getSession.mockResolvedValue({ session: null, error: NextResponse.json({}, { status: 401 }) } as never);
    expect((await POST(req({ lane: 'TOP' }), ctx)).status).toBe(401);
  });

  it('403 sem Discord vinculado', async () => {
    sessao();
    userFind.mockResolvedValue({ discordId: null } as never);
    expect((await POST(req({ lane: 'TOP' }), ctx)).status).toBe(403);
  });

  it('400 para corpo inválido', async () => {
    sessao();
    userFind.mockResolvedValue({ discordId: 'd1' } as never);
    const bad = new Request('http://x', { method: 'POST', body: 'nao-json' }) as never;
    expect((await POST(bad, ctx)).status).toBe(400);
  });

  it('400 para lane inválida', async () => {
    sessao();
    userFind.mockResolvedValue({ discordId: 'd1' } as never);
    expect((await POST(req({ lane: 'XYZ' }), ctx)).status).toBe(400);
  });

  it('404 quando a equipe não existe', async () => {
    sessao();
    userFind.mockResolvedValue({ discordId: 'd1' } as never);
    equipeFind.mockResolvedValue(null);
    expect((await POST(req({ lane: 'TOP' }), ctx)).status).toBe(404);
  });

  it('400 quando o solicitante é o próprio capitão', async () => {
    cenarioBase({ userId: 'u1' });
    expect((await POST(req({ lane: 'TOP' }), ctx)).status).toBe(400);
  });

  it('409 quando a vaga não está disponível', async () => {
    cenarioBase({ vagasLanes: ['MID'] });
    expect((await POST(req({ lane: 'TOP' }), ctx)).status).toBe(409);
  });

  it('403 após 3 recusas pela equipe', async () => {
    cenarioBase();
    candFindMany.mockResolvedValue([{ status: 'RECUSADA' }, { status: 'RECUSADA' }, { status: 'RECUSADA' }] as never);
    expect((await POST(req({ lane: 'TOP' }), ctx)).status).toBe(403);
  });

  it('403 ao atingir o limite de 3 solicitações', async () => {
    cenarioBase();
    candFindMany.mockResolvedValue([{ status: 'PENDENTE' }, { status: 'PENDENTE' }, { status: 'PENDENTE' }] as never);
    expect((await POST(req({ lane: 'TOP' }), ctx)).status).toBe(403);
  });

  it('cria a candidatura e audita (sem canal)', async () => {
    cenarioBase();
    candCreate.mockResolvedValue({ id: 'cand1' } as never);
    const res = await POST(req({ lane: 'TOP' }), ctx);
    expect(res.status).toBe(200);
    expect(candCreate).toHaveBeenCalledOnce();
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'candidatura.create' }));
    expect((await res.json()).noCanal).toBe(false);
  });

  it('com canal: entra no canal e posta o painel de botões', async () => {
    cenarioBase({ discordChannelId: 'chan' });
    candCreate.mockResolvedValue({ id: 'cand1' } as never);
    addMember.mockResolvedValue(true);
    postMsg.mockResolvedValue(true);
    const res = await POST(req({ lane: 'TOP' }), ctx);
    expect(res.status).toBe(200);
    expect(addMember).toHaveBeenCalledWith('chan', 'd1');
    expect(postMsg).toHaveBeenCalledWith('chan', expect.any(String), [{ type: 1 }]);
    expect((await res.json()).noCanal).toBe(true);
  });

  it('é idempotente: não recria se já solicitou', async () => {
    cenarioBase();
    candFindUnique.mockResolvedValue({ id: 'cand-existente' } as never);
    await POST(req({ lane: 'TOP' }), ctx);
    expect(candCreate).not.toHaveBeenCalled();
  });
});
