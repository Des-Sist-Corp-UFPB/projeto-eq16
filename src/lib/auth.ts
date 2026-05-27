import { cookies } from 'next/headers';
import { readDB, User } from './db';

export async function getSessionUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (!token) return null;

    const db = readDB();
    const user = Object.values(db.users).find((u) => u.sessionToken === token);
    if (!user) return null;

    return user;
  } catch (error) {
    console.error('Erro ao recuperar usuário da sessão:', error);
    return null;
  }
}
