import { NextAuthOptions, Account, Profile } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import DiscordProvider from 'next-auth/providers/discord';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { encryptToken, addUserToGuild } from './discord';
import { logAudit, AuditAction } from './audit';

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

/**
 * Cache em memória (TTL curto) dos dados do usuário que o token espelha:
 * papel (role) e vínculo do Discord.
 *
 * Sem ele, cada requisição autenticada custaria uma query no banco. Com o
 * cache, sessões defasadas continuam se autocorrigindo (em até 60s) mas o
 * custo cai para 1 query/minuto por usuário. Login e `update()` continuam
 * forçando leitura fresca.
 *
 * O papel PRECISA ser relido: o JWT é assinado no login e vale por semanas —
 * sem recarga, um admin rebaixado (ou uma conta removida) continuaria com
 * `role: 'ADMIN'` no token e passaria por todas as checagens administrativas
 * até o token expirar. `existe: false` derruba o papel para USER.
 */
const USUARIO_TTL_MS = 60_000;
const USUARIO_CACHE_MAX = 5_000;
interface DadosUsuario {
  existe: boolean;
  role: string;
  discordId: string | null;
  discordUsername: string | null;
  expira: number;
}
const usuarioCache = new Map<string, DadosUsuario>();

async function carregarDadosUsuario(userId: string, forcarLeitura: boolean): Promise<DadosUsuario> {
  const agora = Date.now();
  const cacheado = usuarioCache.get(userId);
  if (!forcarLeitura && cacheado && cacheado.expira > agora) return cacheado;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, discordId: true, discordUsername: true },
  });
  const valor: DadosUsuario = {
    existe: !!dbUser,
    role: dbUser?.role ?? 'USER',
    discordId: dbUser?.discordId ?? null,
    discordUsername: dbUser?.discordUsername ?? null,
    expira: agora + USUARIO_TTL_MS,
  };
  if (usuarioCache.size >= USUARIO_CACHE_MAX) usuarioCache.clear();
  usuarioCache.set(userId, valor);
  return valor;
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

      // (Re)carrega papel e vínculo do Discord a cada requisição autenticada, pelo
      // cache com TTL (ver carregarDadosUsuario): sessões defasadas se autocorrigem
      // em até 60s sem relogar — vale tanto para um vínculo novo do Discord quanto,
      // sobretudo, para uma promoção/rebaixamento de papel ou conta removida.
      // Login e update() forçam leitura fresca do banco.
      if (token.id) {
        const forcarLeitura = !!(user || account?.provider === 'discord' || trigger === 'update');
        const dados = await carregarDadosUsuario(token.id as string, forcarLeitura);
        token.role = dados.role;
        token.discordId = dados.discordId;
        token.discordUsername = dados.discordUsername;
      }

      // Auditoria de login: apenas na entrada inicial (quando há `user`/`account`),
      // já com o nosso id do banco resolvido (não o snowflake do Discord).
      if (token.id && (user || account)) {
        await logAudit({
          action: AuditAction.AUTH_LOGIN,
          actorId: token.id as string,
          actorLabel: token.username as string,
          targetType: 'User',
          targetId: token.id as string,
          metadata: { provider: account?.provider ?? 'credentials' },
        });
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

  events: {
    // Logout: o token JWT ainda traz a identidade no momento da saída.
    async signOut({ token }) {
      if (token?.id) {
        await logAudit({
          action: AuditAction.AUTH_LOGOUT,
          actorId: token.id as string,
          actorLabel: token.username as string,
          targetType: 'User',
          targetId: token.id as string,
        });
      }
    },
  },

  pages: { signIn: '/auth/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};