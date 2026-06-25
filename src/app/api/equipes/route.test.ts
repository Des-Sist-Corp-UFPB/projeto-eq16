import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { equipe: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() }, user: { findUnique: vi.fn() } },
}));
vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));
vi.mock('@/lib/discord', () => ({ createTeamChannel: vi.fn() }));
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  requestMeta: () => ({ ip: null, userAgent: null }),
  AuditAction: { EQUIPE_CREATE: 'equipe.create' },
}));

import { GET, POST } from '@/app/api/equipes/route';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { createTeamChannel } from '@/lib/discord';
import { logAudit } from '@/lib/audit';

const findMany = vi.mocked(prisma.equipe.findMany);
const create = vi.mocked(prisma.equipe.create);
const update = vi.mocked(prisma.equipe.update);
const userFind = vi.mocked(prisma.user.findUnique);
const getSession = vi.mocked(getSessionOrUnauthorized);
const createChannel = vi.mocked(createTeamChannel);

const req = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as never;
function vinculado() {
  getSession.mockResolvedValue({ session: { user: { id: 'u1', username: 'cap', role: 'USER' } }, error: null } as never);
  userFind.mockResolvedValue({ discordId: 'd1' } as never);
}
const corpoValido = { nome: 'Time Alfa', nicknameCapitao: 'Cap#BR1', vagasLanes: ['TOP', 'MID'] };

beforeEach(() => vi.clearAllMocks());

describe('GET /api/equipes', () => {
  it('achata discordUsername e candidaturasCount', async () => {
    findMany.mockResolvedValue([
      { id: 'e1', nome: 'T', nicknameCapitao: 'C#1', vagasLanes: ['TOP'], status: 'ABERTA', createdAt: new Date(), userId: 'u1', user: { discordUsername: 'dux' }, _count: { candidaturas: 3 } },
    ] as never);
    const body = await (await GET()).json();
    expect(body[0]).toMatchObject({ discordUsername: 'dux', candidaturasCount: 3 });
  });
});

describe('POST /api/equipes', () => {
  it('repassa 401', async () => {
    getSession.mockResolvedValue({ session: null, error: NextResponse.json({}, { status: 401 }) } as never);
    expect((await POST(req(corpoValido))).status).toBe(401);
  });

  it('403 sem Discord vinculado', async () => {
    getSession.mockResolvedValue({ session: { user: { id: 'u1', username: 'cap', role: 'USER' } }, error: null } as never);
    userFind.mockResolvedValue({ discordId: null } as never);
    expect((await POST(req(corpoValido))).status).toBe(403);
  });

  it('400 sem nome/nickname', async () => {
    vinculado();
    expect((await POST(req({ vagasLanes: ['TOP'] }))).status).toBe(400);
  });

  it('400 para nickname inválido', async () => {
    vinculado();
    expect((await POST(req({ nome: 'T', nicknameCapitao: 'sem-tag', vagasLanes: ['TOP'] }))).status).toBe(400);
  });

  it('400 sem vagas', async () => {
    vinculado();
    expect((await POST(req({ nome: 'T', nicknameCapitao: 'Cap#BR1', vagasLanes: [] }))).status).toBe(400);
  });

  it('400 com vagas demais (> 5)', async () => {
    vinculado();
    const seis = ['TOP', 'MID', 'ADC', 'SUPPORT', 'JUNGLE', 'FILL'];
    expect((await POST(req({ nome: 'T', nicknameCapitao: 'Cap#BR1', vagasLanes: seis }))).status).toBe(400);
  });

  it('201 cria a equipe, o canal e audita', async () => {
    vinculado();
    create.mockResolvedValue({ id: 'e1', nome: 'Time Alfa', vagasLanes: ['TOP', 'MID'] } as never);
    createChannel.mockResolvedValue('chan-1');
    update.mockResolvedValue({} as never);
    const res = await POST(req(corpoValido));
    expect(res.status).toBe(201);
    expect((await res.json()).discordChannelId).toBe('chan-1');
    expect(update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { discordChannelId: 'chan-1' } });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'equipe.create' }));
  });

  it('201 mesmo quando o canal falha (best-effort)', async () => {
    vinculado();
    create.mockResolvedValue({ id: 'e1', nome: 'Time Alfa', vagasLanes: ['TOP', 'MID'] } as never);
    createChannel.mockRejectedValue(new Error('discord fora'));
    const res = await POST(req(corpoValido));
    expect(res.status).toBe(201);
    expect((await res.json()).discordChannelId).toBeNull();
  });
});
