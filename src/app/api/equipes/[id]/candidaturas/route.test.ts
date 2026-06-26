import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { equipe: { findUnique: vi.fn() }, candidatura: { findMany: vi.fn() } },
}));
vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));

import { GET } from '@/app/api/equipes/[id]/candidaturas/route';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';

const equipeFind = vi.mocked(prisma.equipe.findUnique);
const candFind = vi.mocked(prisma.candidatura.findMany);
const getSession = vi.mocked(getSessionOrUnauthorized);

const ctx = { params: Promise.resolve({ id: 'e1' }) };
const reqv = () => new Request('http://x') as never;
function sessao(id = 'cap', role = 'USER') {
  getSession.mockResolvedValue({ session: { user: { id, username: 'x', role } }, error: null } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/equipes/[id]/candidaturas', () => {
  it('repassa 401', async () => {
    getSession.mockResolvedValue({ session: null, error: NextResponse.json({}, { status: 401 }) } as never);
    expect((await GET(reqv(), ctx)).status).toBe(401);
  });

  it('404 quando a equipe não existe', async () => {
    sessao();
    equipeFind.mockResolvedValue(null);
    expect((await GET(reqv(), ctx)).status).toBe(404);
  });

  it('403 quando não é capitão nem admin', async () => {
    sessao('outro');
    equipeFind.mockResolvedValue({ userId: 'cap' } as never);
    expect((await GET(reqv(), ctx)).status).toBe(403);
  });

  it('o capitão recebe a lista achatada (nickname do free agent)', async () => {
    sessao('cap');
    equipeFind.mockResolvedValue({ userId: 'cap' } as never);
    candFind.mockResolvedValue([
      { id: 'c1', lane: 'TOP', status: 'PENDENTE', createdAt: new Date(), user: { username: 'jog', discordUsername: 'jog#1', freeAgents: [{ nickname: 'Nick#BR1' }] } },
    ] as never);
    const body = await (await GET(reqv(), ctx)).json();
    expect(body[0]).toMatchObject({ id: 'c1', username: 'jog', nickname: 'Nick#BR1' });
  });
});
