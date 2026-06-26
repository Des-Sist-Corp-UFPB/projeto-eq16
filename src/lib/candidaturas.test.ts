import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    candidatura: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    equipe: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/discord', () => ({
  removeMemberFromChannel: vi.fn(),
  postChannelMessage: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { removeMemberFromChannel, postChannelMessage } from '@/lib/discord';
import { aceitarCandidatura, recusarCandidatura } from '@/lib/candidaturas';

const findUnique = vi.mocked(prisma.candidatura.findUnique);
const findMany = vi.mocked(prisma.candidatura.findMany);
const update = vi.mocked(prisma.candidatura.update);
const updateMany = vi.mocked(prisma.candidatura.updateMany);
const equipeUpdate = vi.mocked(prisma.equipe.update);
const $transaction = vi.mocked(prisma.$transaction);
const postMsg = vi.mocked(postChannelMessage);
const removeMember = vi.mocked(removeMemberFromChannel);

type CandOverrides = Partial<{
  status: string;
  lane: string;
  equipe: { userId: string; vagasLanes: string[]; discordChannelId: string | null };
  user: { discordId: string | null; discordUsername: string | null };
}>;

function cand(o: CandOverrides = {}) {
  return {
    id: 'c1',
    lane: 'TOP',
    status: 'PENDENTE',
    equipeId: 'e1',
    userId: 'u-player',
    equipe: { userId: 'u-cap', vagasLanes: ['TOP'], discordChannelId: null },
    user: { discordId: null, discordUsername: 'Player' },
    ...o,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  $transaction.mockResolvedValue([] as never);
  findMany.mockResolvedValue([] as never); // default: sem "outros" candidatos
  postMsg.mockResolvedValue(true);
  removeMember.mockResolvedValue(true);
});

describe('aceitarCandidatura — guardas', () => {
  it('404 quando a candidatura não existe', async () => {
    findUnique.mockResolvedValue(null);
    await expect(aceitarCandidatura('c1', 'u-cap', false)).rejects.toMatchObject({ status: 404 });
  });

  it('403 quando o ator não é o capitão (nem admin)', async () => {
    findUnique.mockResolvedValue(cand() as never);
    await expect(aceitarCandidatura('c1', 'estranho', false)).rejects.toMatchObject({ status: 403 });
  });

  it('admin pode agir mesmo sem ser o capitão', async () => {
    findUnique.mockResolvedValue(cand() as never);
    const r = await aceitarCandidatura('c1', 'admin', true);
    expect(r.status).toBe('ACEITA');
  });

  it('é idempotente: candidatura já decidida não reprocessa', async () => {
    findUnique.mockResolvedValue(cand({ status: 'ACEITA' }) as never);
    const r = await aceitarCandidatura('c1', 'u-cap', false);
    expect(r).toEqual({ status: 'ACEITA', jaProcessada: true });
    expect($transaction).not.toHaveBeenCalled();
  });

  it('409 quando a lane não está mais em vagasLanes', async () => {
    findUnique.mockResolvedValue(
      cand({ equipe: { userId: 'u-cap', vagasLanes: ['MID'], discordChannelId: null } }) as never
    );
    await expect(aceitarCandidatura('c1', 'u-cap', false)).rejects.toMatchObject({ status: 409 });
  });
});

describe('aceitarCandidatura — efeitos', () => {
  it('último slot da lane → equipe COMPLETA', async () => {
    findUnique.mockResolvedValue(cand() as never);
    findMany.mockResolvedValue([] as never);
    const r = await aceitarCandidatura('c1', 'u-cap', false);
    expect(r).toMatchObject({ status: 'ACEITA', vagasRestantes: [], equipeStatus: 'COMPLETA', recusados: 0 });
    expect(equipeUpdate).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { vagasLanes: [], status: 'COMPLETA' },
    });
  });

  it('ainda há slot da mesma lane → equipe segue ABERTA, sem recusar outros', async () => {
    findUnique.mockResolvedValue(
      cand({ equipe: { userId: 'u-cap', vagasLanes: ['TOP', 'TOP'], discordChannelId: null } }) as never
    );
    const r = await aceitarCandidatura('c1', 'u-cap', false);
    expect(r).toMatchObject({ vagasRestantes: ['TOP'], equipeStatus: 'ABERTA' });
    expect(findMany).not.toHaveBeenCalled(); // lane não fechou → não busca "outros"
  });

  it('ao fechar a lane, recusa os outros candidatos e revoga acesso ao canal', async () => {
    findUnique.mockResolvedValue(
      cand({
        equipe: { userId: 'u-cap', vagasLanes: ['TOP'], discordChannelId: 'chan' },
        user: { discordId: 'd-player', discordUsername: 'Player' },
      }) as never
    );
    findMany.mockResolvedValue([{ id: 'c2', user: { discordId: 'd-other' } }] as never);

    const r = await aceitarCandidatura('c1', 'u-cap', false);

    expect(r.recusados).toBe(1);
    expect(updateMany).toHaveBeenCalled(); // recusa em lote
    expect(postMsg).toHaveBeenCalledWith('chan', expect.stringContaining('aceito'));
    expect(removeMember).toHaveBeenCalledWith('chan', 'd-other');
  });
});

describe('recusarCandidatura', () => {
  it('recusa e revoga o acesso ao canal', async () => {
    findUnique.mockResolvedValue(
      cand({
        equipe: { userId: 'u-cap', vagasLanes: ['TOP'], discordChannelId: 'chan' },
        user: { discordId: 'd-player', discordUsername: 'P' },
      }) as never
    );
    const r = await recusarCandidatura('c1', 'u-cap', false);
    expect(r).toEqual({ status: 'RECUSADA' });
    expect(update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { status: 'RECUSADA' } });
    expect(removeMember).toHaveBeenCalledWith('chan', 'd-player');
  });

  it('é idempotente quando já decidida', async () => {
    findUnique.mockResolvedValue(cand({ status: 'RECUSADA' }) as never);
    const r = await recusarCandidatura('c1', 'u-cap', false);
    expect(r).toEqual({ status: 'RECUSADA', jaProcessada: true });
    expect(update).not.toHaveBeenCalled();
  });

  it('403 quando não é o capitão', async () => {
    findUnique.mockResolvedValue(cand() as never);
    await expect(recusarCandidatura('c1', 'estranho', false)).rejects.toMatchObject({ status: 403 });
  });
});
