import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';

// GET /api/usuarios/me — dados do perfil do usuário logado.
export async function GET() {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      username: true,
      role: true,
      createdAt: true,
      discordId: true,
      discordUsername: true,
      password: true,
    },
  });

  if (!user) {
    return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 });
  }

  // Nunca expõe o hash — só informa se existe senha local (para a tela de Segurança).
  const { password, ...rest } = user;
  return NextResponse.json({ ...rest, hasPassword: !!password });
}
