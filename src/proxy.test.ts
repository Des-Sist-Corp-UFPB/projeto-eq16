import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }));

import { getToken } from 'next-auth/jwt';
import { proxy, config } from '@/proxy';

const token = vi.mocked(getToken);

const req = (path: string) => new NextRequest(`http://x${path}`);

beforeEach(() => vi.clearAllMocks());

describe('proxy — triagem das rotas administrativas', () => {
  it('cobre tanto as páginas quanto a API de admin', () => {
    expect(config.matcher).toEqual(['/admin/:path*', '/api/admin/:path*']);
  });

  it('anônimo em página admin vai para o login preservando o destino', async () => {
    token.mockResolvedValue(null);
    const res = await proxy(req('/admin/auditoria?page=3'));
    expect(res.status).toBe(307);
    const destino = new URL(res.headers.get('location')!);
    expect(destino.pathname).toBe('/auth/login');
    expect(destino.searchParams.get('redirect')).toBe('/admin/auditoria?page=3');
  });

  it('anônimo na API admin recebe 401 (sem redirect)', async () => {
    token.mockResolvedValue(null);
    const res = await proxy(req('/api/admin/audit-logs'));
    expect(res.status).toBe(401);
  });

  it('usuário comum em página admin é mandado para /inicio', async () => {
    token.mockResolvedValue({ id: 'u1', role: 'USER' } as never);
    const res = await proxy(req('/admin/auditoria'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/inicio');
  });

  it('usuário comum na API admin recebe 403', async () => {
    token.mockResolvedValue({ id: 'u1', role: 'USER' } as never);
    const res = await proxy(req('/api/admin/audit-logs'));
    expect(res.status).toBe(403);
  });

  it('token sem papel é tratado como não-admin', async () => {
    token.mockResolvedValue({ id: 'u1' } as never);
    const res = await proxy(req('/api/admin/audit-logs'));
    expect(res.status).toBe(403);
  });

  it('admin passa, com noindex e sem cache', async () => {
    token.mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    const res = await proxy(req('/admin/auditoria'));
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});
