import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  requestMeta: () => ({ ip: null, userAgent: null }),
  AuditAction: { PASSWORD_CHANGE: 'password.change' },
}));

import { PATCH } from '@/app/api/usuarios/mudar-senha/route';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { logAudit } from '@/lib/audit';

const findUnique = vi.mocked(prisma.user.findUnique);
const update = vi.mocked(prisma.user.update);
const getSession = vi.mocked(getSessionOrUnauthorized);

const req = (body: unknown) => new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) }) as never;
function sessao() {
  getSession.mockResolvedValue({ session: { user: { id: 'u1', username: 'x', role: 'USER' } }, error: null } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/usuarios/mudar-senha', () => {
  it('repassa 401', async () => {
    getSession.mockResolvedValue({ session: null, error: NextResponse.json({}, { status: 401 }) } as never);
    expect((await PATCH(req({}))).status).toBe(401);
  });

  it('400 sem campos', async () => {
    sessao();
    expect((await PATCH(req({ senhaAtual: '' }))).status).toBe(400);
  });

  it('400 com nova senha curta', async () => {
    sessao();
    expect((await PATCH(req({ senhaAtual: 'atual123', novaSenha: '123' }))).status).toBe(400);
  });

  it('404 quando o usuário some', async () => {
    sessao();
    findUnique.mockResolvedValue(null);
    expect((await PATCH(req({ senhaAtual: 'atual123', novaSenha: 'nova12345' }))).status).toBe(404);
  });

  it('400 para conta só-Discord (sem senha local)', async () => {
    sessao();
    findUnique.mockResolvedValue({ id: 'u1', username: 'x', password: null } as never);
    expect((await PATCH(req({ senhaAtual: 'atual123', novaSenha: 'nova12345' }))).status).toBe(400);
  });

  it('403 quando a senha atual está errada', async () => {
    sessao();
    const hash = await bcrypt.hash('correta123', 4);
    findUnique.mockResolvedValue({ id: 'u1', username: 'x', password: hash } as never);
    expect((await PATCH(req({ senhaAtual: 'ERRADA', novaSenha: 'nova12345' }))).status).toBe(403);
  });

  it('200 troca a senha e audita', async () => {
    sessao();
    const hash = await bcrypt.hash('correta123', 4);
    findUnique.mockResolvedValue({ id: 'u1', username: 'x', password: hash } as never);
    update.mockResolvedValue({} as never);
    const res = await PATCH(req({ senhaAtual: 'correta123', novaSenha: 'nova12345' }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledOnce();
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'password.change' }));
  });
});
