import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  requestMeta: () => ({ ip: null, userAgent: null }),
  AuditAction: { USER_REGISTER: 'user.register' },
}));

import { POST } from '@/app/api/usuarios/registro/route';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

const findUnique = vi.mocked(prisma.user.findUnique);
const create = vi.mocked(prisma.user.create);

function req(body: unknown) {
  return new Request('http://x/api/usuarios/registro', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as never;
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/usuarios/registro', () => {
  it('400 sem usuário/senha', async () => {
    const res = await POST(req({ username: '' }));
    expect(res.status).toBe(400);
  });

  it('400 com senha curta', async () => {
    const res = await POST(req({ username: 'foo', password: '123' }));
    expect(res.status).toBe(400);
  });

  it('409 quando o username já existe', async () => {
    findUnique.mockResolvedValue({ id: 'x' } as never);
    const res = await POST(req({ username: 'foo', password: 'senha123' }));
    expect(res.status).toBe(409);
  });

  it('201 cria o usuário e registra auditoria', async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: 'u1', username: 'foo' } as never);
    const res = await POST(req({ username: 'foo', password: 'senha123' }));
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe('u1');
    expect(create).toHaveBeenCalledOnce();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.register', actorId: 'u1' })
    );
  });
});
