import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));

import { GET } from '@/app/api/usuarios/me/route';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';

const findUnique = vi.mocked(prisma.user.findUnique);
const getSession = vi.mocked(getSessionOrUnauthorized);

function comSessao() {
  getSession.mockResolvedValue({ session: { user: { id: 'u1', username: 'x', role: 'USER' } }, error: null } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/usuarios/me', () => {
  it('repassa 401 quando não autenticado', async () => {
    getSession.mockResolvedValue({ session: null, error: NextResponse.json({}, { status: 401 }) } as never);
    expect((await GET()).status).toBe(401);
  });

  it('404 quando o usuário some', async () => {
    comSessao();
    findUnique.mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
  });

  it('não expõe o hash, só hasPassword', async () => {
    comSessao();
    findUnique.mockResolvedValue({ username: 'x', role: 'USER', createdAt: new Date(), discordId: null, discordUsername: null, password: 'HASH' } as never);
    const body = await (await GET()).json();
    expect(body.password).toBeUndefined();
    expect(body.hasPassword).toBe(true);
  });

  it('hasPassword=false para conta só-Discord', async () => {
    comSessao();
    findUnique.mockResolvedValue({ username: 'x', role: 'USER', createdAt: new Date(), discordId: 'd', discordUsername: 'd', password: null } as never);
    expect((await (await GET()).json()).hasPassword).toBe(false);
  });
});
