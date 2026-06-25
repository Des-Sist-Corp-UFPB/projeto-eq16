import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/discordInteractions', () => ({
  verifyInteractionSignature: vi.fn(),
  handleInteraction: vi.fn(),
}));

import { POST } from '@/app/api/discord/interactions/route';
import { verifyInteractionSignature, handleInteraction } from '@/lib/discordInteractions';

const verify = vi.mocked(verifyInteractionSignature);
const handle = vi.mocked(handleInteraction);

function req(body: string) {
  return new Request('http://x/api/discord/interactions', {
    method: 'POST',
    body,
    headers: { 'x-signature-ed25519': 'sig', 'x-signature-timestamp': 'ts' },
  }) as never;
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/discord/interactions', () => {
  it('401 quando a assinatura é inválida (não chama o handler)', async () => {
    verify.mockReturnValue(false);
    const res = await POST(req('{"type":1}'));
    expect(res.status).toBe(401);
    expect(handle).not.toHaveBeenCalled();
  });

  it('responde com o resultado do handler quando válido', async () => {
    verify.mockReturnValue(true);
    handle.mockResolvedValue({ type: 1 });
    const res = await POST(req('{"type":1}'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 1 });
    expect(handle).toHaveBeenCalledWith({ type: 1 });
  });

  it('400 quando o corpo não é JSON válido', async () => {
    verify.mockReturnValue(true);
    const res = await POST(req('nao-json'));
    expect(res.status).toBe(400);
    expect(handle).not.toHaveBeenCalled();
  });
});
