import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  requestMeta: () => ({ ip: null, userAgent: null }),
  AuditAction: { DISCORD_UNLINK: 'discord.unlink' },
}));

import { POST } from '@/app/api/discord/unlink/route';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { logAudit } from '@/lib/audit';

const findUnique = vi.mocked(prisma.user.findUnique);
const update = vi.mocked(prisma.user.update);
const getSession = vi.mocked(getSessionOrUnauthorized);
const reqv = () => new Request('http://x', { method: 'POST' }) as never;

beforeEach(() => vi.clearAllMocks());

describe('POST /api/discord/unlink', () => {
  it('repassa 401 quando não autenticado', async () => {
    getSession.mockResolvedValue({ session: null, error: NextResponse.json({}, { status: 401 }) } as never);
    expect((await POST(reqv())).status).toBe(401);
  });

  it('zera os campos do Discord e audita', async () => {
    getSession.mockResolvedValue({ session: { user: { id: 'u1', username: 'x', role: 'USER' } }, error: null } as never);
    findUnique.mockResolvedValue({ discordId: 'd1', discordUsername: 'foo' } as never);
    update.mockResolvedValue({} as never);

    const res = await POST(reqv());
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ discordId: null, discordAccessToken: null }) }));
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'discord.unlink' }));
  });
});
