import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { logAudit, requestMeta, listAuditLogs, listAuditActions, AuditAction } from '@/lib/audit';

const create = vi.mocked(prisma.auditLog.create);
const count = vi.mocked(prisma.auditLog.count);
const findMany = vi.mocked(prisma.auditLog.findMany);

beforeEach(() => vi.clearAllMocks());

describe('logAudit', () => {
  it('grava o evento mapeando os campos', async () => {
    create.mockResolvedValue({} as never);
    await logAudit({
      action: AuditAction.EQUIPE_CREATE,
      actorId: 'u1',
      actorLabel: 'capi',
      targetType: 'Equipe',
      targetId: 'e1',
      metadata: { nome: 'X' },
      ip: '1.2.3.4',
      userAgent: 'UA',
    });
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.action).toBe('equipe.create');
    expect(data.actorId).toBe('u1');
    expect(data.metadata).toEqual({ nome: 'X' });
    expect(data.ip).toBe('1.2.3.4');
  });

  it('normaliza campos ausentes (actorId null)', async () => {
    create.mockResolvedValue({} as never);
    await logAudit({ action: AuditAction.AUTH_LOGIN });
    const data = create.mock.calls[0][0].data;
    expect(data.actorId).toBeNull();
    expect(data.metadata).toBeDefined(); // Prisma.JsonNull
  });

  it('é best-effort: engole erro do banco sem lançar', async () => {
    create.mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(logAudit({ action: AuditAction.AUTH_LOGOUT })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('requestMeta', () => {
  it('pega o primeiro IP do x-forwarded-for + user-agent', () => {
    const req = new Request('http://x', {
      headers: { 'x-forwarded-for': '9.9.9.9, 8.8.8.8', 'user-agent': 'UA1' },
    });
    expect(requestMeta(req)).toEqual({ ip: '9.9.9.9', userAgent: 'UA1' });
  });

  it('cai no x-real-ip quando não há x-forwarded-for', () => {
    const req = new Request('http://x', { headers: { 'x-real-ip': '7.7.7.7' } });
    expect(requestMeta(req)).toEqual({ ip: '7.7.7.7', userAgent: null });
  });

  it('retorna nulls sem headers de origem', () => {
    expect(requestMeta(new Request('http://x'))).toEqual({ ip: null, userAgent: null });
  });
});

describe('listAuditLogs', () => {
  it('aplica filtros e calcula a paginação', async () => {
    count.mockResolvedValue(120 as never);
    findMany.mockResolvedValue([{ id: 'a' }] as never);
    const r = await listAuditLogs({ page: 2, action: 'equipe.create', actorId: 'u1' });

    expect(count).toHaveBeenCalledWith({ where: { action: 'equipe.create', actorId: 'u1' } });
    const fm = findMany.mock.calls[0][0]!;
    expect(fm.where).toEqual({ action: 'equipe.create', actorId: 'u1' });
    expect(fm.skip).toBe(50); // (2-1)*50
    expect(fm.take).toBe(50);
    expect(r.totalPages).toBe(3); // ceil(120/50)
    expect(r.page).toBe(2);
  });

  it('normaliza página < 1 e where vazio sem filtros', async () => {
    count.mockResolvedValue(0 as never);
    findMany.mockResolvedValue([] as never);
    const r = await listAuditLogs({ page: -5 });
    expect(r.page).toBe(1);
    expect(r.totalPages).toBe(1); // max(1, ceil(0/50))
    expect(findMany.mock.calls[0][0]!.where).toEqual({});
  });
});

describe('listAuditActions', () => {
  it('retorna as ações distintas', async () => {
    findMany.mockResolvedValue([{ action: 'a' }, { action: 'b' }] as never);
    expect(await listAuditActions()).toEqual(['a', 'b']);
  });
});
