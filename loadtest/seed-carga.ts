/**
 * Seed de CARGA — popula o banco local com volume realista para o teste de
 * performance (listagens vazias respondem rápido demais e mascaram gargalos).
 *
 * Uso:
 *   npx tsx loadtest/seed-carga.ts                 # 150 free agents, 40 equipes
 *   AGENTS=500 EQUIPES=100 npx tsx loadtest/seed-carga.ts
 *
 * Idempotente: remove os dados de rodadas anteriores (usuários `carga_*`)
 * antes de recriar. NUNCA rode contra o banco compartilhado da disciplina.
 */
import 'dotenv/config';
import { PrismaClient, Lane } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const TOTAL_AGENTS = Number(process.env.AGENTS ?? 150);
const TOTAL_EQUIPES = Number(process.env.EQUIPES ?? 40);

const LANES: Lane[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

function laneAleatoria(exceto?: Lane): Lane {
  const opcoes = LANES.filter((l) => l !== exceto);
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}

async function main() {
  console.log(`Seed de carga: ${TOTAL_AGENTS} free agents + ${TOTAL_EQUIPES} equipes...`);

  // Limpa rodadas anteriores (cascade remove free agents/equipes/candidaturas).
  const removidos = await prisma.user.deleteMany({
    where: { username: { startsWith: 'carga_' } },
  });
  if (removidos.count) console.log(`  removidos ${removidos.count} usuários de rodadas anteriores`);

  // createMany em lotes: MUITO mais rápido que um create por linha.
  const agora = Date.now();
  const usuarios = Array.from({ length: TOTAL_AGENTS + TOTAL_EQUIPES }, (_, i) => ({
    username: `carga_${i}`,
    // Sem senha (como contas via Discord). O login do k6 usa outro usuário.
    discordId: `9000000000000${String(i).padStart(5, '0')}`,
    discordUsername: `carga_user_${i}`,
  }));
  await prisma.user.createMany({ data: usuarios });

  const ids = await prisma.user.findMany({
    where: { username: { startsWith: 'carga_' } },
    select: { id: true },
    orderBy: { username: 'asc' },
  });

  const freeAgents = ids.slice(0, TOTAL_AGENTS).map((u, i) => {
    const principal: Lane = i % 7 === 0 ? 'FILL' : LANES[i % LANES.length];
    return {
      nickname: `Carga Player ${i}#EQ16`,
      lanePrincipal: principal,
      laneSecundaria: principal === 'FILL' ? null : laneAleatoria(principal),
      userId: u.id,
      createdAt: new Date(agora - i * 60_000), // espalha no tempo (ordenação real)
    };
  });
  await prisma.freeAgent.createMany({ data: freeAgents });

  const equipes = ids.slice(TOTAL_AGENTS).map((u, i) => {
    const qtdVagas = 1 + (i % 5);
    return {
      nome: `Equipe Carga ${i}`,
      nicknameCapitao: `Capitao ${i}#EQ16`,
      vagasLanes: Array.from({ length: qtdVagas }, (_, v) => LANES[(i + v) % LANES.length]),
      userId: u.id,
      createdAt: new Date(agora - i * 90_000),
    };
  });
  await prisma.equipe.createMany({ data: equipes });

  console.log('Seed de carga concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
