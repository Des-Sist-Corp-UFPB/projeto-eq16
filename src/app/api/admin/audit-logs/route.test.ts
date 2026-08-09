import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/apiAuth', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/audit', () => ({ listAuditLogs: vi.fn() }));

import { GET } from '@/app/api/admin/audit-logs/route';
import { requireAdmin } from '@/lib/apiAuth';
import { listAuditLogs } from '@/lib/audit';

const guard = vi.mocked(requireAdmin);
const list = vi.mocked(listAuditLogs);

function reqUrl(qs = '') {
  return new NextRequest(`http://x/api/admin/audit-logs${qs}`);
}
function comoAdmin() {
  guard.mockResolvedValue({
    session: { user: { id: 'u1', username: 'x', role: 'ADMIN' } },
    error: null,
  } as never);
}
function bloqueado(status: number) {
  guard.mockResolvedValue({
    session: null,
    error: NextResponse.json({ erro: 'nope' }, { status }),
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/admin/audit-logs', () => {
  it('repassa 401 quando não autenticado', async () => {
    bloqueado(401);
    expect((await GET(reqUrl())).status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });

  it('repassa 403 para usuário não-admin', async () => {
    bloqueado(403);
    expect((await GET(reqUrl())).status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });

  it('200 para admin, repassando os filtros', async () => {
    comoAdmin();
    list.mockResolvedValue({ page: 2, pageSize: 50, total: 0, totalPages: 1, logs: [] } as never);
    const res = await GET(reqUrl('?page=2&action=equipe.create&actorId=u9'));
    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ page: 2, action: 'equipe.create', actorId: 'u9' });
  });

  it('não permite cache da trilha em intermediários', async () => {
    comoAdmin();
    list.mockResolvedValue({ page: 1, pageSize: 50, total: 0, totalPages: 1, logs: [] } as never);
    const res = await GET(reqUrl());
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});
