import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock('@/lib/discord', () => ({
  exchangeCodeForToken: vi.fn(),
  fetchDiscordUser: vi.fn(),
  addUserToGuild: vi.fn(),
  encryptToken: (t: string) => `enc(${t})`,
}));
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  requestMeta: () => ({ ip: null, userAgent: null }),
  AuditAction: { DISCORD_LINK: 'discord.link' },
}));

import { GET } from '@/app/api/discord/callback/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { exchangeCodeForToken, fetchDiscordUser, addUserToGuild } from '@/lib/discord';
import { logAudit } from '@/lib/audit';

const session = vi.mocked(getServerSession);
const userFind = vi.mocked(prisma.user.findUnique);
const userUpdate = vi.mocked(prisma.user.update);
const exchange = vi.mocked(exchangeCodeForToken);
const fetchUser = vi.mocked(fetchDiscordUser);
const join = vi.mocked(addUserToGuild);

function reqComState(qsState = 's1', cookieState: string | null = 's1') {
  const headers: Record<string, string> = {};
  if (cookieState !== null) headers.cookie = `discord_oauth_state=${cookieState}`;
  return new NextRequest(`http://x/api/discord/callback?code=c1&state=${qsState}`, { headers });
}
function localizacao(res: Response) {
  return res.headers.get('location') ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ user: { id: 'u1', username: 'x' } } as never);
});

describe('GET /api/discord/callback', () => {
  it('redireciona com erro_login sem sessão', async () => {
    session.mockResolvedValue(null);
    expect(localizacao(await GET(reqComState()))).toContain('discord=erro_login');
  });

  it('redireciona com erro_state quando o state não confere', async () => {
    const res = await GET(reqComState('s1', 'OUTRO'));
    expect(localizacao(res)).toContain('discord=erro_state');
  });

  it('redireciona com ja_vinculado quando o Discord pertence a outra conta', async () => {
    exchange.mockResolvedValue({ access_token: 'a', refresh_token: 'r', expires_in: 60 } as never);
    fetchUser.mockResolvedValue({ id: 'd42', username: 'foo', global_name: null } as never);
    userFind.mockResolvedValue({ id: 'outra-conta' } as never);
    expect(localizacao(await GET(reqComState()))).toContain('discord=ja_vinculado');
  });

  it('vincula com sucesso: salva tokens cifrados, faz auto-join e audita', async () => {
    exchange.mockResolvedValue({ access_token: 'a', refresh_token: 'r', expires_in: 60 } as never);
    fetchUser.mockResolvedValue({ id: 'd42', username: 'foo', global_name: null } as never);
    userFind.mockResolvedValue(null); // discord livre
    userUpdate.mockResolvedValue({} as never);
    join.mockResolvedValue('joined');

    const res = await GET(reqComState());
    expect(localizacao(res)).toContain('discord=ok');
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ discordId: 'd42', discordAccessToken: 'enc(a)' }) })
    );
    expect(join).toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'discord.link' }));
  });
});
