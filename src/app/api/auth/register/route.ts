import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { readDB, writeDB, User } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 });
    }

    const db = readDB();
    const normalizedEmail = email.toLowerCase().trim();

    if (db.users[normalizedEmail]) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 400 });
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const userId = 'u_' + Math.random().toString(36).substring(2, 11);

    const newUser: User = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      role: 'USER', // Padrão é USER, vira ADMIN ao criar uma casa
      houseId: null,
      passwordHash,
    };

    db.users[normalizedEmail] = newUser;
    writeDB(db);

    // Retornar usuário sem dados confidenciais
    return NextResponse.json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      houseId: newUser.houseId,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao cadastrar: ' + error.message }, { status: 500 });
  }
}
