import { NextRequest, NextResponse } from 'next/server';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { listAuditLogs } from '@/lib/audit';

// GET /api/admin/audit-logs?page=&action=&actorId= — somente ADMIN.
// Lista paginada da trilha de auditoria (mais recentes primeiro).
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json({ erro: 'Acesso restrito a administradores.' }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const result = await listAuditLogs({
    page: Number(params.get('page')) || 1,
    action: params.get('action') ?? undefined,
    actorId: params.get('actorId') ?? undefined,
  });

  return NextResponse.json(result);
}
