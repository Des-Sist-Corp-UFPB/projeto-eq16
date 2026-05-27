import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { readDB, writeDB, House } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'O nome da casa é obrigatório.' }, { status: 400 });
    }

    const db = readDB();
    const dbUser = db.users[user.email];

    if (dbUser.houseId) {
      return NextResponse.json({ error: 'Você já participa de uma casa.' }, { status: 400 });
    }

    // Gerar código único de 6 caracteres maiúsculos/números
    let code = '';
    let codeExists = true;
    while (codeExists) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      codeExists = Object.values(db.houses).some((h) => h.code === code);
    }

    const houseId = 'h_' + Math.random().toString(36).substring(2, 11);

    const newHouse: House = {
      id: houseId,
      name: name.trim(),
      code,
      adminId: dbUser.id,
      residents: [dbUser.id],
      currentExpenses: [],
      history: [],
    };

    // Atualizar usuário como ADMIN desta casa
    dbUser.houseId = houseId;
    dbUser.role = 'ADMIN';

    db.houses[houseId] = newHouse;
    writeDB(db);

    return NextResponse.json(newHouse, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao criar casa: ' + error.message }, { status: 500 });
  }
}
