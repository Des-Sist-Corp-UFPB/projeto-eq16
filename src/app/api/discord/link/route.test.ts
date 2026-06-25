import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));
vi.mock('@/lib/discord', () => ({ buildAuthorizeUrl: vi.fn() }));

import { GET } from '@/app/api/discord/link/route';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { buildAuthorizeUrl } from '@/lib/discord';

const getSession = vi.mocked(getSessionOrUnauthorized);
const authorize = vi.mocked(buildAuthorizeUrl);

beforeEach(() => vi.clearAllMocks());

describe('GET /api/discord/link', () => {
  it('repassa 401 quando não autenticado', async () => {
    getSession.mockResolvedValue({ session: null, error: NextResponse.json({}, { status: 401 }) } as never);
    expect((await GET()).status).toBe(401);
  });

  it('503 quando a integração não está configurada', async () => {
    getSession.mockResolvedValue({ session: { user: { id: 'u1' } }, error: null } as never);
    authorize.mockImplementation(() => {
      throw new Error('não configurado');
    });
    expect((await GET()).status).toBe(503);
  });

  it('redireciona ao Discord e seta o cookie de state (CSRF)', async () => {
    getSession.mockResolvedValue({ session: { user: { id: 'u1' } }, error: null } as never);
    authorize.mockReturnValue('https://discord.com/oauth2/authorize?x=1');
    const res = await GET();
    expect([302, 307, 308]).toContain(res.status);
    expect(res.headers.get('set-cookie')).toContain('discord_oauth_state');
    // o state gerado é passado para buildAuthorizeUrl
    expect(authorize).toHaveBeenCalledWith(expect.any(String));
  });
});
