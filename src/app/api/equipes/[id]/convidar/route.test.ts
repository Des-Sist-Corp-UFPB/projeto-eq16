import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    equipe: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    candidatura: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));
vi.mock('@/lib/discord', () => ({ addMemberToChannel: vi.fn(), postChannelMessage: vi.fn() }));
vi.mock('@/lib/discordInteractions', () => ({ buildCandidaturaButtons: () => ['botoes'] }));
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  requestMeta: () => ({ ip: null, userAgent: null }),
  AuditAction: { CANDIDATURA_INVITE: 'candidatura.invite' },
}));

import { POST } from '@/app/api/equipes/[id]/convidar/route';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { addMemberToChannel, postChannelMessage } from '@/lib/discord';
import { logAudit } from '@/lib/audit';

const equipeFind = vi.mocked(prisma.equipe.findUnique);
const userFind = vi.mocked(prisma.user.findUnique);
const candFind = vi.mocked(prisma.candidatura.findUnique);
const candCreate = vi.mocked(prisma.candidatura.create);
const getSession = vi.mocked(getSessionOrUnauthorized);
const addMembro = vi.mocked(addMemberToChannel);
const postMsg = vi.mocked(postChannelMessage);

const params = Promise.resolve({ id: 'eq1' });
const req = (body: unknown) =>
  new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as never;
const corpoValido = { userId: 'jogador1', lane: 'MID' };

function sessaoCapitao() {
  getSession.mockResolvedValue({
    session: { user: { id: 'cap1', username: 'capitao', role: 'USER' } },
    error: null,
  } as never);
}

/** Equipe do capitão logado, com vaga de MID e canal no Discord. */
function equipeDoCapitao(extras: Record<string, unknown> = {}) {
  equipeFind.mockResolvedValue({
    id: 'eq1',
    nome: 'Time X',
    userId: 'cap1',
    vagasLanes: ['MID', 'ADC'],
    discordChannelId: 'canal1',
    ...extras,
  } as never);
}

/** Capitão com Discord vinculado + convidado que é free agent. */
function usuariosOk(convidado: Record<string, unknown> = {}) {
  userFind.mockImplementation((async ({ where }: { where: { id: string } }) =>
    where.id === 'cap1'
      ? { discordId: 'disc-cap', discordUsername: 'cap#0' }
      : {
          username: 'jogador',
          discordId: 'disc-jog',
          discordUsername: 'jog#0',
          freeAgents: [{ nickname: 'Nick#BR1' }],
          ...convidado,
        }) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  candFind.mockResolvedValue(null as never);
  candCreate.mockResolvedValue({ id: 'cand1' } as never);
  addMembro.mockResolvedValue(true);
  postMsg.mockResolvedValue(true);
});

describe('POST /api/equipes/[id]/convidar', () => {
  it('repassa 401 quando não autenticado', async () => {
    getSession.mockResolvedValue({
      session: null,
      error: NextResponse.json({ erro: 'Não autenticado' }, { status: 401 }),
    } as never);
    expect((await POST(req(corpoValido), { params })).status).toBe(401);
  });

  it('400 para lane ou jogador inválidos', async () => {
    sessaoCapitao();
    expect((await POST(req({ userId: 'jogador1', lane: 'BOT' }), { params })).status).toBe(400);
    expect((await POST(req({ lane: 'MID' }), { params })).status).toBe(400);
    expect(equipeFind).not.toHaveBeenCalled();
  });

  it('404 quando a equipe não existe', async () => {
    sessaoCapitao();
    equipeFind.mockResolvedValue(null as never);
    expect((await POST(req(corpoValido), { params })).status).toBe(404);
  });

  it('403 quando quem convida não é o capitão da equipe', async () => {
    sessaoCapitao();
    equipeDoCapitao({ userId: 'outro' });
    const res = await POST(req(corpoValido), { params });
    expect(res.status).toBe(403);
    expect(candCreate).not.toHaveBeenCalled();
  });

  it('400 ao convidar a si mesmo', async () => {
    sessaoCapitao();
    equipeDoCapitao();
    expect((await POST(req({ userId: 'cap1', lane: 'MID' }), { params })).status).toBe(400);
  });

  it('409 quando a vaga não está mais aberta', async () => {
    sessaoCapitao();
    equipeDoCapitao({ vagasLanes: ['ADC'] });
    expect((await POST(req(corpoValido), { params })).status).toBe(409);
  });

  it('403 quando o capitão não tem Discord vinculado', async () => {
    sessaoCapitao();
    equipeDoCapitao();
    userFind.mockResolvedValue({ discordId: null } as never);
    expect((await POST(req(corpoValido), { params })).status).toBe(403);
    expect(candCreate).not.toHaveBeenCalled();
  });

  it('404 quando o convidado não é um free agent', async () => {
    sessaoCapitao();
    equipeDoCapitao();
    usuariosOk({ freeAgents: [] });
    expect((await POST(req(corpoValido), { params })).status).toBe(404);
  });

  it('201 cria a candidatura, audita e leva o convidado ao canal do Discord', async () => {
    sessaoCapitao();
    equipeDoCapitao();
    usuariosOk();

    const res = await POST(req(corpoValido), { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({ status: 'PENDENTE', noCanal: true });
    expect(candCreate).toHaveBeenCalledWith({
      data: { equipeId: 'eq1', userId: 'jogador1', lane: 'MID' },
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'candidatura.invite', targetId: 'cand1' })
    );
    expect(addMembro).toHaveBeenCalledWith('canal1', 'disc-jog');
    // Painel de Aceitar/Recusar postado no canal (mesma máquina da solicitação).
    expect(postMsg).toHaveBeenCalledWith('canal1', expect.stringContaining('<@disc-jog>'), ['botoes']);
  });

  it('201 sem Discord do convidado: registra o convite e não chama o canal', async () => {
    sessaoCapitao();
    equipeDoCapitao();
    usuariosOk({ discordId: null });

    const res = await POST(req(corpoValido), { params });
    expect(res.status).toBe(201);
    expect(candCreate).toHaveBeenCalledOnce();
    expect(addMembro).not.toHaveBeenCalled();
    expect(postMsg).not.toHaveBeenCalled();
  });

  it('é idempotente: convite repetido devolve o estado atual sem duplicar', async () => {
    sessaoCapitao();
    equipeDoCapitao();
    usuariosOk();
    candFind.mockResolvedValue({ id: 'cand-existente', status: 'PENDENTE' } as never);

    const res = await POST(req(corpoValido), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: 'PENDENTE', jaExistia: true });
    expect(candCreate).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('convite para quem já foi recusado devolve o status sem recriar', async () => {
    sessaoCapitao();
    equipeDoCapitao();
    usuariosOk();
    candFind.mockResolvedValue({ id: 'cand-x', status: 'RECUSADA' } as never);

    const body = await (await POST(req(corpoValido), { params })).json();
    expect(body).toMatchObject({ status: 'RECUSADA', jaExistia: true });
    expect(body.mensagem).toContain('recusado');
    expect(candCreate).not.toHaveBeenCalled();
  });
});
