import { NextAuthOptions, Account, Profile } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import DiscordProvider from 'next-auth/providers/discord';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { encryptToken, addUserToGuild } from './discord';

interface DiscordProfile extends Profile {
  id: string;
  username: string;
  global_name?: string | null;
}

/** Gera um username único a partir do nick do Discord (username é @unique). */
async function gerarUsernameUnico(base: string): Promise<string> {
  const slug = base.trim().replace(/\s+/g, '_').slice(0, 24) || 'jogador';
  let candidato = slug;
  let i = 0;
  while (await prisma.user.findUnique({ where: { username: candidato }, select: { id: true } })) {
    i += 1;
    candidato = `${slug}_${i}`;
  }
  return candidato;
}

/** Best-effort: adiciona o usuário ao servidor (não bloqueia o login). */
async function tentarAutoJoin(discordId: string, account: Account | null): Promise<void> {
  if (!account?.access_token) return;
  try {
    await addUserToGuild(discordId, account.access_token);
  } catch {
    // ignora — falha de auto-join não impede o login.
  }
}

/**
 * Login via Discord: recupera a conta pelo discordId ou cria uma nova (sem senha).
 * Retorna os dados que vão para o JWT.
 */
async function sincronizarLoginDiscord(
  profile: DiscordProfile,
  account: Account | null
): Promise<{ id: string; username: string; role: string }> {
  const discordId = profile.id;
  const discordUsername = profile.username;

  const dadosToken = account?.access_token
    ? {
        discordAccessToken: encryptToken(account.access_token),
        discordRefreshToken: account.refresh_token ? encryptToken(account.refresh_token) : null,
        discordTokenExpires: account.expires_at ? new Date(account.expires_at * 1000) : null,
      }
    : {};

  const existente = await prisma.user.findUnique({
    where: { discordId },
    select: { id: true, username: true, role: true },
  });

  if (existente) {
    await prisma.user.update({
      where: { id: existente.id },
      data: { discordUsername, ...dadosToken },
    });
    await tentarAutoJoin(discordId, account);
    return existente;
  }

  const username = await gerarUsernameUnico(discordUsername || `discord_${discordId}`);
  const criado = await prisma.user.create({
    data: { username, discordId, discordUsername, ...dadosToken },
    select: { id: true, username: true, role: true },
  });
  await tentarAutoJoin(discordId, account);
  return criado;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Usuário', type: 'text' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });

        // Contas criadas via Discord não têm senha local — não logam por aqui.
        if (!user || !user.password) return null;

        const senhaCorreta = await bcrypt.compare(credentials.password, user.password);
        if (!senhaCorreta) return null;

        return { id: user.id, username: user.username, role: user.role };
      },
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
      authorization: { params: { scope: 'identify guilds.join' } },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account, profile, trigger }) {
      // Login via Credentials
      if (user && (!account || account.provider === 'credentials')) {
        const u = user as { id: string; username: string; role: string };
        token.id = u.id;
        token.username = u.username;
        token.role = u.role;
      }

      // Login via Discord (OAuth): auto-cria/recupera a conta por discordId
      if (account?.provider === 'discord' && profile) {
        const dbUser = await sincronizarLoginDiscord(profile as DiscordProfile, account);
        token.id = dbUser.id;
        token.username = dbUser.username;
        token.role = dbUser.role;
      }

      // (Re)carrega o vínculo do Discord do banco: no login, no login-Discord, no update()
      // e SEMPRE que o token ainda não tem discordId — assim sessões defasadas (ex.: vínculo
      // feito sem passar por update()) se autocorrigem na próxima requisição, sem relogar.
      if (token.id && (user || account?.provider === 'discord' || trigger === 'update' || !token.discordId)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { discordId: true, discordUsername: true },
        });
        token.discordId = dbUser?.discordId ?? null;
        token.discordUsername = dbUser?.discordUsername ?? null;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.discordId = (token.discordId as string | null) ?? null;
        session.user.discordUsername = (token.discordUsername as string | null) ?? null;
        session.user.discordLinked = !!token.discordId;
      }
      return session;
    },
  },

  pages: { signIn: '/auth/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};