import { describe, it, expect, vi, beforeEach } from 'vitest';

// Evita carregar o módulo pesado do NextAuth (que puxa prisma/discord/audit).
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

import { getServerSession } from 'next-auth';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';

const mockSession = vi.mocked(getServerSession);

beforeEach(() => vi.clearAllMocks());

describe('getSessionOrUnauthorized', () => {
  it('retorna 401 quando não há sessão', async () => {
    mockSession.mockResolvedValue(null);
    const { session, error } = await getSessionOrUnauthorized();
    expect(session).toBeNull();
    expect(error?.status).toBe(401);
  });

  it('retorna a sessão quando autenticado', async () => {
    const fake = { user: { id: 'u1', username: 'foo' } };
    mockSession.mockResolvedValue(fake as never);
    const { session, error } = await getSessionOrUnauthorized();
    expect(error).toBeNull();
    expect(session).toBe(fake);
  });
});
