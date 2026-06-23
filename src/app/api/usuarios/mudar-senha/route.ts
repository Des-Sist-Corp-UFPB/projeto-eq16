import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';

export async function PATCH(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  try {
    const { senhaAtual, novaSenha } = await req.json();

    if (!senhaAtual || !novaSenha) {
      return NextResponse.json(
        { erro: 'Campos obrigatórios não preenchidos' },
        { status: 400 }
      );
    }

    if (novaSenha.length < 6) {
      return NextResponse.json(
        { erro: 'A nova senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session!.user.id },
    });

    if (!user) {
      return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 });
    }

    if (!user.password) {
      return NextResponse.json(
        { erro: 'Sua conta entra pelo Discord e não possui senha local para alterar.' },
        { status: 400 }
      );
    }

    const senhaCorreta = await bcrypt.compare(senhaAtual, user.password);
    if (!senhaCorreta) {
      return NextResponse.json({ erro: 'Senha atual incorreta' }, { status: 403 });
    }

    const novoHash = await bcrypt.hash(novaSenha, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: novoHash },
    });

    return NextResponse.json({ mensagem: 'Senha alterada com sucesso' });
  } catch {
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 });
  }
}
