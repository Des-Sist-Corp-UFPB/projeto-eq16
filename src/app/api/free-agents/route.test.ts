import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { freeAgent: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() }, user: { findUnique: vi.fn() } },
}));
vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  requestMeta: () => ({ ip: null, userAgent: null }),
  AuditAction: { FREEAGENT_CREATE: 'freeagent.create' },
}));

import { GET, POST } from '@/app/api/free-agents/route';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { logAudit } from '@/lib/audit';

const faFindMany = vi.mocked(prisma.freeAgent.findMany);
const faFindFirst = vi.mocked(prisma.freeAgent.findFirst);
const faCreate = vi.mocked(prisma.freeAgent.create);
const userFind = vi.mocked(prisma.user.findUnique);
const getSession = vi.mocked(getSessionOrUnauthorized);

const req = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as never;
function sessao() {
  getSession.mockResolvedValue({ session: { user: { id: 'u1', username: 'x', role: 'USER' } }, error: null } as never);
}
/** caminho comum: logado + discord vinculado + ainda sem free agent. */
function vinculadoSemFA() {
  sessao();
  userFind.mockResolvedValue({ discordId: 'd1' } as never);
  faFindFirst.mockResolvedValue(null);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/free-agents', () => {
  it('lista achatando o discordUsername do dono', async () => {
    faFindMany.mockResolvedValue([
      { id: 'fa1', nickname: 'N', lanePrincipal: 'TOP', laneSecundaria: 'MID', createdAt: new Date(), userId: 'u1', user: { discordUsername: 'dux' } },
    ] as never);
    const body = await (await GET()).json();
    expect(body[0]).toMatchObject({ id: 'fa1', discordUsername: 'dux' });
  });
});

describe('POST /api/free-agents', () => {
  it('repassa 401', async () => {
    getSession.mockResolvedValue({ session: null, error: NextResponse.json({}, { status: 401 }) } as never);
    expect((await POST(req({}))).status).toBe(401);
  });

  it('403 sem Discord vinculado', async () => {
    sessao();
    userFind.mockResolvedValue({ discordId: null } as never);
    expect((await POST(req({}))).status).toBe(403);
  });

  it('409 quando já possui um free agent', async () => {
    sessao();
    userFind.mockResolvedValue({ discordId: 'd1' } as never);
    faFindFirst.mockResolvedValue({ id: 'fa-existente' } as never);
    expect((await POST(req({}))).status).toBe(409);
  });

  it('400 sem campos obrigatórios', async () => {
    vinculadoSemFA();
    expect((await POST(req({ nickname: '' }))).status).toBe(400);
  });

  it('400 quando falta a lane secundária (não-FILL)', async () => {
    vinculadoSemFA();
    expect((await POST(req({ nickname: 'Nick#BR1', lanePrincipal: 'TOP' }))).status).toBe(400);
  });

  it('400 quando secundária == principal', async () => {
    vinculadoSemFA();
    expect((await POST(req({ nickname: 'Nick#BR1', lanePrincipal: 'TOP', laneSecundaria: 'TOP' }))).status).toBe(400);
  });

  it('400 para nickname fora do formato Nome#TAG', async () => {
    vinculadoSemFA();
    expect((await POST(req({ nickname: 'invalido', lanePrincipal: 'TOP', laneSecundaria: 'MID' }))).status).toBe(400);
  });

  it('201 cria (FILL dispensa secundária) e audita', async () => {
    vinculadoSemFA();
    faCreate.mockResolvedValue({ id: 'fa1' } as never);
    const res = await POST(req({ nickname: 'Nick#BR1', lanePrincipal: 'FILL' }));
    expect(res.status).toBe(201);
    expect(faCreate).toHaveBeenCalledOnce();
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'freeagent.create' }));
  });
});
