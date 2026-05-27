import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 });
    }

    const db = readDB();
    const normalizedEmail = email.toLowerCase().trim();
    const user = db.users[normalizedEmail];

    if (!user) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    if (user.passwordHash !== passwordHash) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }

    // Gerar token de sessão seguro
    const sessionToken = crypto.randomBytes(32).toString('hex');
    user.sessionToken = sessionToken;
    writeDB(db);

    // Definir cookie HTTP-only de sessão
    const cookieStore = await cookies();
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 semana
      sameSite: 'lax',
      path: '/',
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      houseId: user.houseId,
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao fazer login: ' + error.message }, { status: 500 });
  }
}
