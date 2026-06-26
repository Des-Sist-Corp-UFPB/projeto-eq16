import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock('@/lib/candidaturas', () => {
  class CandidaturaError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    aceitarCandidatura: vi.fn(),
    recusarCandidatura: vi.fn(),
    CandidaturaError,
  };
});
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  AuditAction: { CANDIDATURA_ACCEPT: 'candidatura.accept', CANDIDATURA_REJECT: 'candidatura.reject' },
}));

import { prisma } from '@/lib/prisma';
import { aceitarCandidatura, recusarCandidatura, CandidaturaError } from '@/lib/candidaturas';
import { logAudit } from '@/lib/audit';
import {
  verifyInteractionSignature,
  handleInteraction,
  buildCandidaturaButtons,
  InteractionResponseType,
  CANDIDATURA_PANEL_PREFIX,
} from '@/lib/discordInteractions';

const findUser = vi.mocked(prisma.user.findUnique);
const aceitar = vi.mocked(aceitarCandidatura);
const recusar = vi.mocked(recusarCandidatura);

// Par de chaves Ed25519 real para os testes de assinatura.
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const spki = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
const pubHex = spki.subarray(spki.length - 32).toString('hex');
const sign = (msg: string) => crypto.sign(null, Buffer.from(msg), privateKey).toString('hex');

beforeEach(() => vi.clearAllMocks());

describe('verifyInteractionSignature', () => {
  it('aceita assinatura válida', () => {
    const ts = '1700000000';
    const body = '{"type":1}';
    const ok = verifyInteractionSignature({ rawBody: body, timestamp: ts, signature: sign(ts + body), publicKey: pubHex });
    expect(ok).toBe(true);
  });

  it('rejeita assinatura inválida', () => {
    const ts = '1700000000';
    const body = '{"type":1}';
    const ok = verifyInteractionSignature({ rawBody: body, timestamp: ts, signature: sign(ts + 'OUTRO'), publicKey: pubHex });
    expect(ok).toBe(false);
  });

  it('rejeita quando falta public key', () => {
    delete process.env.DISCORD_PUBLIC_KEY;
    expect(verifyInteractionSignature({ rawBody: '{}', timestamp: '1', signature: 'ab' })).toBe(false);
  });

  it('rejeita quando faltam signature/timestamp', () => {
    expect(verifyInteractionSignature({ rawBody: '{}', timestamp: null, signature: null, publicKey: pubHex })).toBe(false);
  });

  it('rejeita public key malformada (não lança)', () => {
    expect(verifyInteractionSignature({ rawBody: '{}', timestamp: '1', signature: 'zz', publicKey: 'nao-e-hex' })).toBe(false);
  });
});

describe('buildCandidaturaButtons', () => {
  it('gera action row com Aceitar/Recusar e custom_ids', () => {
    const rows = buildCandidaturaButtons('cand-1');
    const botoes = (rows[0] as { components: { custom_id: string; label: string }[] }).components;
    expect(botoes.map((b) => b.label)).toEqual(['Aceitar', 'Recusar']);
    expect(botoes[0].custom_id).toBe(`${CANDIDATURA_PANEL_PREFIX}:aceitar:cand-1`);
    expect(botoes[1].custom_id).toBe(`${CANDIDATURA_PANEL_PREFIX}:recusar:cand-1`);
  });
});

describe('handleInteraction', () => {
  it('responde PONG ao PING', async () => {
    expect(await handleInteraction({ type: 1 })).toEqual({ type: InteractionResponseType.PONG });
  });

  it('ignora tipos não suportados', async () => {
    const r = await handleInteraction({ type: 2 });
    expect(r.data?.content).toMatch(/não suportada/i);
  });
});

describe('handleInteraction — botões (MESSAGE_COMPONENT)', () => {
  const comp = (customId: string, discordId: string | undefined = 'd-cap') => ({
    type: 3,
    data: { custom_id: customId },
    member: discordId ? { user: { id: discordId } } : undefined,
  });

  it('rejeita custom_id desconhecido', async () => {
    const r = await handleInteraction(comp('lixo:abc'));
    expect(r.data?.content).toMatch(/desconhecida/i);
  });

  it('rejeita quando não identifica quem clicou', async () => {
    // interação sem `member`/`user` → não há discordId do clicante
    const r = await handleInteraction({ type: 3, data: { custom_id: `${CANDIDATURA_PANEL_PREFIX}:aceitar:c1` } });
    expect(r.data?.content).toMatch(/identificar/i);
  });

  it('rejeita quando o Discord não está vinculado', async () => {
    findUser.mockResolvedValue(null);
    const r = await handleInteraction(comp(`${CANDIDATURA_PANEL_PREFIX}:aceitar:c1`));
    expect(r.data?.content).toMatch(/não está vinculada/i);
  });

  it('aceita: chama o núcleo, audita e atualiza o painel', async () => {
    findUser.mockResolvedValue({ id: 'u-cap', username: 'cap', role: 'USER' } as never);
    aceitar.mockResolvedValue({ status: 'ACEITA', vagasRestantes: [], equipeStatus: 'COMPLETA', recusados: 0 } as never);

    const r = await handleInteraction(comp(`${CANDIDATURA_PANEL_PREFIX}:aceitar:c1`));

    expect(aceitar).toHaveBeenCalledWith('c1', 'u-cap', false);
    expect(logAudit).toHaveBeenCalledOnce();
    expect(r.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(r.data?.content).toMatch(/aceita/i);
    expect(r.data?.components).toEqual([]);
  });

  it('passa isAdmin=true quando o ator é ADMIN', async () => {
    findUser.mockResolvedValue({ id: 'u-adm', username: 'adm', role: 'ADMIN' } as never);
    aceitar.mockResolvedValue({ status: 'ACEITA' } as never);
    await handleInteraction(comp(`${CANDIDATURA_PANEL_PREFIX}:aceitar:c1`));
    expect(aceitar).toHaveBeenCalledWith('c1', 'u-adm', true);
  });

  it('recusa: chama o núcleo e atualiza o painel', async () => {
    findUser.mockResolvedValue({ id: 'u-cap', username: 'cap', role: 'USER' } as never);
    recusar.mockResolvedValue({ status: 'RECUSADA' } as never);
    const r = await handleInteraction(comp(`${CANDIDATURA_PANEL_PREFIX}:recusar:c1`));
    expect(recusar).toHaveBeenCalledWith('c1', 'u-cap', false);
    expect(r.data?.content).toMatch(/recusada/i);
  });

  it('traduz CandidaturaError em mensagem efêmera', async () => {
    findUser.mockResolvedValue({ id: 'u-cap', username: 'cap', role: 'USER' } as never);
    aceitar.mockRejectedValue(new CandidaturaError('Essa vaga já foi preenchida.', 409));
    const r = await handleInteraction(comp(`${CANDIDATURA_PANEL_PREFIX}:aceitar:c1`));
    expect(r.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(r.data?.content).toMatch(/já foi preenchida/i);
  });

  it('erro genérico vira mensagem efêmera neutra', async () => {
    findUser.mockResolvedValue({ id: 'u-cap', username: 'cap', role: 'USER' } as never);
    aceitar.mockRejectedValue(new Error('boom'));
    const r = await handleInteraction(comp(`${CANDIDATURA_PANEL_PREFIX}:aceitar:c1`));
    expect(r.data?.content).toMatch(/erro/i);
  });
});
