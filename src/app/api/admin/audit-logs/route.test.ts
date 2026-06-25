import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));
vi.mock('@/lib/audit', () => ({ listAuditLogs: vi.fn() }));

import { GET } from '@/app/api/admin/audit-logs/route';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { listAuditLogs } from '@/lib/audit';

const getSession = vi.mocked(getSessionOrUnauthorized);
const list = vi.mocked(listAuditLogs);

function reqUrl(qs = '') {
  return new NextRequest(`http://x/api/admin/audit-logs${qs}`);
}
function comSessao(role: string) {
  getSession.mockResolvedValue({
    session: { user: { id: 'u1', username: 'x', role } },
    error: null,
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/admin/audit-logs', () => {
  it('repassa 401 quando não autenticado', async () => {
    getSession.mockResolvedValue({
      session: null,
      error: NextResponse.json({ erro: 'Não autenticado' }, { status: 401 }),
    } as never);
    expect((await GET(reqUrl())).status).toBe(401);
  });

  it('403 para usuário não-admin', async () => {
    comSessao('USER');
    expect((await GET(reqUrl())).status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });

  it('200 para admin, repassando os filtros', async () => {
    comSessao('ADMIN');
    list.mockResolvedValue({ page: 2, pageSize: 50, total: 0, totalPages: 1, logs: [] } as never);
    const res = await GET(reqUrl('?page=2&action=equipe.create&actorId=u9'));
    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ page: 2, action: 'equipe.create', actorId: 'u9' });
  });
});
