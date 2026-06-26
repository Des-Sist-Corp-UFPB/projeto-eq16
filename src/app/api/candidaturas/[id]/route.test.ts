import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/apiAuth', () => ({ getSessionOrUnauthorized: vi.fn() }));
vi.mock('@/lib/candidaturas', () => {
  class CandidaturaError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return { aceitarCandidatura: vi.fn(), recusarCandidatura: vi.fn(), CandidaturaError };
});
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  requestMeta: () => ({ ip: null, userAgent: null }),
  AuditAction: { CANDIDATURA_ACCEPT: 'candidatura.accept', CANDIDATURA_REJECT: 'candidatura.reject' },
}));

import { PATCH } from '@/app/api/candidaturas/[id]/route';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { aceitarCandidatura, recusarCandidatura, CandidaturaError } from '@/lib/candidaturas';
import { logAudit } from '@/lib/audit';

const getSession = vi.mocked(getSessionOrUnauthorized);
const aceitar = vi.mocked(aceitarCandidatura);
const recusar = vi.mocked(recusarCandidatura);

const ctx = { params: Promise.resolve({ id: 'c1' }) };
function req(body: unknown) {
  return new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) }) as never;
}
function comSessao(role = 'USER') {
  getSession.mockResolvedValue({
    session: { user: { id: 'u1', username: 'cap', role } },
    error: null,
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/candidaturas/[id]', () => {
  it('repassa o 401 quando não autenticado', async () => {
    getSession.mockResolvedValue({
      session: null,
      error: NextResponse.json({ erro: 'Não autenticado' }, { status: 401 }),
    } as never);
    const res = await PATCH(req({ acao: 'aceitar' }), ctx);
    expect(res.status).toBe(401);
  });

  it('aceitar: chama o núcleo e audita', async () => {
    comSessao();
    aceitar.mockResolvedValue({ status: 'ACEITA' } as never);
    const res = await PATCH(req({ acao: 'aceitar' }), ctx);
    expect(res.status).toBe(200);
    expect(aceitar).toHaveBeenCalledWith('c1', 'u1', false);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'candidatura.accept' }));
  });

  it('recusar: chama o núcleo e audita', async () => {
    comSessao();
    recusar.mockResolvedValue({ status: 'RECUSADA' } as never);
    await PATCH(req({ acao: 'recusar' }), ctx);
    expect(recusar).toHaveBeenCalledWith('c1', 'u1', false);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'candidatura.reject' }));
  });

  it('admin: passa isAdmin=true', async () => {
    comSessao('ADMIN');
    aceitar.mockResolvedValue({ status: 'ACEITA' } as never);
    await PATCH(req({ acao: 'aceitar' }), ctx);
    expect(aceitar).toHaveBeenCalledWith('c1', 'u1', true);
  });

  it('400 para ação inválida', async () => {
    comSessao();
    const res = await PATCH(req({ acao: 'explodir' }), ctx);
    expect(res.status).toBe(400);
  });

  it('mapeia CandidaturaError para o status correspondente', async () => {
    comSessao();
    aceitar.mockRejectedValue(new CandidaturaError('Essa vaga já foi preenchida.', 409));
    const res = await PATCH(req({ acao: 'aceitar' }), ctx);
    expect(res.status).toBe(409);
  });

  it('400 para corpo inválido (JSON quebrado)', async () => {
    comSessao();
    const bad = new Request('http://x', { method: 'PATCH', body: 'nao-json' }) as never;
    const res = await PATCH(bad, ctx);
    expect(res.status).toBe(400);
  });
});
