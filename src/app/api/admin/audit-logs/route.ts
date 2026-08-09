import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';
import { listAuditLogs } from '@/lib/audit';

// A trilha de auditoria não pode ser cacheada em nenhuma camada: é dado
// sensível e específico do admin autenticado.
export const dynamic = 'force-dynamic';

// GET /api/admin/audit-logs?page=&action=&actorId= — somente ADMIN.
// Lista paginada da trilha de auditoria (mais recentes primeiro).
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const result = await listAuditLogs({
    page: Number(params.get('page')) || 1,
    action: params.get('action') ?? undefined,
    actorId: params.get('actorId') ?? undefined,
  });

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store, private' },
  });
}
