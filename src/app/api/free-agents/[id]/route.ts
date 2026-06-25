import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { logAudit, requestMeta, AuditAction } from '@/lib/audit';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  const { id } = await params;

  const freeAgent = await prisma.freeAgent.findUnique({
    where: { id },
  });

  if (!freeAgent) {
    return NextResponse.json({ erro: 'Free agent não encontrado' }, { status: 404 });
  }

  const isAdmin = session!.user.role === 'ADMIN';
  const isOwner = freeAgent.userId === session!.user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 });
  }

  await prisma.freeAgent.delete({ where: { id } });

  await logAudit({
    action: AuditAction.FREEAGENT_DELETE,
    actorId: session!.user.id,
    actorLabel: session!.user.username,
    targetType: 'FreeAgent',
    targetId: id,
    metadata: { nickname: freeAgent.nickname, porAdmin: isAdmin && !isOwner },
    ...requestMeta(req),
  });

  return NextResponse.json({ mensagem: 'Free agent removido com sucesso' });
}
