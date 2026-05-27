import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDB, writeDB } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function POST() {
  try {
    const user = await getSessionUser();
    if (user) {
      const db = readDB();
      const dbUser = db.users[user.email];
      if (dbUser) {
        delete dbUser.sessionToken;
        writeDB(db);
      }
    }

    const cookieStore = await cookies();
    cookieStore.set('session_token', '', {
      httpOnly: true,
      expires: new Date(0),
      path: '/',
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao fazer logout: ' + error.message }, { status: 500 });
  }
}
