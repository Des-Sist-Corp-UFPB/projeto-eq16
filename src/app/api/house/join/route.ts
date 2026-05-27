import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { code } = await request.json();
    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'O código da casa é obrigatório.' }, { status: 400 });
    }

    const db = readDB();
    const dbUser = db.users[user.email];

    if (dbUser.houseId) {
      return NextResponse.json({ error: 'Você já participa de uma casa.' }, { status: 400 });
    }

    // Procura casa pelo código (case-insensitive para melhor usabilidade)
    const targetCode = code.trim().toUpperCase();
    const house = Object.values(db.houses).find((h) => h.code === targetCode);

    if (!house) {
      return NextResponse.json({ error: 'Código de casa inválido ou inexistente.' }, { status: 404 });
    }

    // Evita duplicatas de moradores (mitigação de bugs)
    if (!house.residents.includes(dbUser.id)) {
      house.residents.push(dbUser.id);
    }

    dbUser.houseId = house.id;
    dbUser.role = 'USER'; // Entrou via código, vira USER padrão

    writeDB(db);

    return NextResponse.json(house, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao entrar na casa: ' + error.message }, { status: 500 });
  }
}
