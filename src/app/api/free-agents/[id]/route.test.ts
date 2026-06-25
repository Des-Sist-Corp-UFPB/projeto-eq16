import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({ prisma: { freeAgent: { findUnique: vi.fn(), delete: vi.fn() } } }));
vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  requestMeta: () => ({ ip: null, userAgent: null }),
  AuditAction: { FREEAGENT_DELETE: 'freeagent.delete' },
}));

import { DELETE } from '@/app/api/free-agents/[id]/route';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { logAudit } from '@/lib/audit';

const findUnique = vi.mocked(prisma.freeAgent.findUnique);
const del = vi.mocked(prisma.freeAgent.delete);
const getSession = vi.mocked(getSessionOrUnauthorized);

const ctx = { params: Promise.resolve({ id: 'fa1' }) };
const reqv = () => new Request('http://x', { method: 'DELETE' }) as never;
function sessao(id = 'u1', role = 'USER') {
  getSession.mockResolvedValue({ session: { user: { id, username: 'x', role } }, error: null } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('DELETE /api/free-agents/[id]', () => {
  it('repassa 401', async () => {
    getSession.mockResolvedValue({ session: null, error: NextResponse.json({}, { status: 401 }) } as never);
    expect((await DELETE(reqv(), ctx)).status).toBe(401);
  });

  it('404 quando não existe', async () => {
    sessao();
    findUnique.mockResolvedValue(null);
    expect((await DELETE(reqv(), ctx)).status).toBe(404);
  });

  it('403 quando não é dono nem admin', async () => {
    sessao('outro');
    findUnique.mockResolvedValue({ id: 'fa1', userId: 'dono', nickname: 'N' } as never);
    expect((await DELETE(reqv(), ctx)).status).toBe(403);
    expect(del).not.toHaveBeenCalled();
  });

  it('o dono remove e audita', async () => {
    sessao('dono');
    findUnique.mockResolvedValue({ id: 'fa1', userId: 'dono', nickname: 'N' } as never);
    del.mockResolvedValue({} as never);
    const res = await DELETE(reqv(), ctx);
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledWith({ where: { id: 'fa1' } });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'freeagent.delete' }));
  });
});
