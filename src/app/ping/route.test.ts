import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { GET, OPTIONS } from './route';

const queryRaw = vi.mocked(prisma.$queryRaw);

beforeEach(() => vi.clearAllMocks());

describe('GET /ping', () => {
  it('responde 200 quando o banco responde ao SELECT', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }] as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(body.service).toBe('eq16');
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('responde 500 quando o banco falha', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.status).toBe('error');
    expect(body.database).toBe('error');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('não vaza detalhe do erro do banco na resposta', async () => {
    queryRaw.mockRejectedValue(new Error('postgres://user:senha@host:5432/eq16'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET();

    expect(JSON.stringify(await res.json())).not.toContain('senha');
    spy.mockRestore();
  });

  it('mantém os headers de CORS nos dois caminhos', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }] as never);
    const ok = await GET();
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('*');

    queryRaw.mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const erro = await GET();
    expect(erro.headers.get('Access-Control-Allow-Origin')).toBe('*');
    spy.mockRestore();
  });
});

describe('OPTIONS /ping', () => {
  it('responde 200 sem tocar no banco (preflight)', async () => {
    const res = await OPTIONS();

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
