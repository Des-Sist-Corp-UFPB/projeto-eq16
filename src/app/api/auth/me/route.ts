import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      houseId: user.houseId,
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao validar sessão: ' + error.message }, { status: 500 });
  }
}
