import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { equipe: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}));
vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));
vi.mock('@/lib/discord', () => ({ deleteChannel: vi.fn() }));
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  requestMeta: () => ({ ip: null, userAgent: null }),
  AuditAction: { EQUIPE_UPDATE: 'equipe.update', EQUIPE_DELETE: 'equipe.delete' },
}));

import { PUT, DELETE } from '@/app/api/equipes/[id]/route';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { deleteChannel } from '@/lib/discord';
import { logAudit } from '@/lib/audit';

const findUnique = vi.mocked(prisma.equipe.findUnique);
const update = vi.mocked(prisma.equipe.update);
const del = vi.mocked(prisma.equipe.delete);
const getSession = vi.mocked(getSessionOrUnauthorized);
const delChannel = vi.mocked(deleteChannel);

const ctx = { params: Promise.resolve({ id: 'e1' }) };
const reqPut = (body: unknown) => new Request('http://x', { method: 'PUT', body: JSON.stringify(body) }) as never;
const reqDel = () => new Request('http://x', { method: 'DELETE' }) as never;
function sessao(id = 'cap', role = 'USER') {
  getSession.mockResolvedValue({ session: { user: { id, username: 'x', role } }, error: null } as never);
}
const corpo = { nome: 'Novo', nicknameCapitao: 'Cap#BR1', vagasLanes: ['TOP'] };

beforeEach(() => vi.clearAllMocks());

describe('PUT /api/equipes/[id]', () => {
  it('repassa 401', async () => {
    getSession.mockResolvedValue({ session: null, error: NextResponse.json({}, { status: 401 }) } as never);
    expect((await PUT(reqPut(corpo), ctx)).status).toBe(401);
  });

  it('404 quando não existe', async () => {
    sessao();
    findUnique.mockResolvedValue(null);
    expect((await PUT(reqPut(corpo), ctx)).status).toBe(404);
  });

  it('403 quando não é dono nem admin', async () => {
    sessao('outro');
    findUnique.mockResolvedValue({ id: 'e1', userId: 'dono' } as never);
    expect((await PUT(reqPut(corpo), ctx)).status).toBe(403);
  });

  it('400 para nickname inválido', async () => {
    sessao('dono');
    findUnique.mockResolvedValue({ id: 'e1', userId: 'dono' } as never);
    expect((await PUT(reqPut({ nome: 'T', nicknameCapitao: 'sem-tag', vagasLanes: ['TOP'] }), ctx)).status).toBe(400);
  });

  it('200 atualiza e audita', async () => {
    sessao('dono');
    findUnique.mockResolvedValue({ id: 'e1', userId: 'dono' } as never);
    update.mockResolvedValue({ id: 'e1', nome: 'Novo', vagasLanes: ['TOP'] } as never);
    const res = await PUT(reqPut(corpo), ctx);
    expect(res.status).toBe(200);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'equipe.update' }));
  });
});

describe('DELETE /api/equipes/[id]', () => {
  it('404 quando não existe', async () => {
    sessao();
    findUnique.mockResolvedValue(null);
    expect((await DELETE(reqDel(), ctx)).status).toBe(404);
  });

  it('403 quando não é dono nem admin', async () => {
    sessao('outro');
    findUnique.mockResolvedValue({ id: 'e1', userId: 'dono', discordChannelId: null } as never);
    expect((await DELETE(reqDel(), ctx)).status).toBe(403);
  });

  it('200 remove, apaga o canal e audita', async () => {
    sessao('dono');
    findUnique.mockResolvedValue({ id: 'e1', userId: 'dono', nome: 'T', discordChannelId: 'chan' } as never);
    del.mockResolvedValue({} as never);
    delChannel.mockResolvedValue(undefined);
    const res = await DELETE(reqDel(), ctx);
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledWith({ where: { id: 'e1' } });
    expect(delChannel).toHaveBeenCalledWith('chan');
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'equipe.delete' }));
  });
});
