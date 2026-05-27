import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { readDB } from '@/lib/db';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const db = readDB();
    const dbUser = db.users[user.email];

    if (!dbUser.houseId) {
      return NextResponse.json({ house: null }, { status: 200 });
    }

    const house = db.houses[dbUser.houseId];
    if (!house) {
      // Usuário tem houseId mas a casa sumiu/foi deletada (mitigação de inconsistência)
      dbUser.houseId = null;
      dbUser.role = 'USER';
      // writeDB(db) omitido aqui para manter GET puro, mas limparemos na UI
      return NextResponse.json({ house: null }, { status: 200 });
    }

    // Carregar informações seguras dos moradores para exibição na UI
    const residentsDetail = Object.values(db.users)
      .filter((u) => u.houseId === house.id)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      }));

    return NextResponse.json({
      house: {
        id: house.id,
        name: house.name,
        code: house.code,
        adminId: house.adminId,
        residents: house.residents,
        currentExpenses: house.currentExpenses,
        history: house.history,
      },
      residents: residentsDetail,
      currentUser: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
      }
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar status da casa: ' + error.message }, { status: 500 });
  }
}
