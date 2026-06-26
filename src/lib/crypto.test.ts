import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt } from '@/lib/crypto';

describe('crypto (AES-256-GCM)', () => {
  const original = {
    enc: process.env.DISCORD_TOKEN_ENC_KEY,
    na: process.env.NEXTAUTH_SECRET,
  };

  beforeEach(() => {
    process.env.DISCORD_TOKEN_ENC_KEY = 'chave-de-teste-super-secreta';
    process.env.NEXTAUTH_SECRET = 'nextauth-de-teste';
  });

  afterEach(() => {
    process.env.DISCORD_TOKEN_ENC_KEY = original.enc;
    process.env.NEXTAUTH_SECRET = original.na;
  });

  it('faz round-trip encrypt → decrypt', () => {
    const enc = encrypt('token-secreto-123');
    expect(enc).not.toBe('token-secreto-123');
    expect(enc.split(':')).toHaveLength(3); // iv:tag:cipher
    expect(decrypt(enc)).toBe('token-secreto-123');
  });

  it('usa IV aleatório (dois encrypts do mesmo texto diferem)', () => {
    expect(encrypt('x')).not.toBe(encrypt('x'));
  });

  it('decrypt rejeita payload em formato inválido', () => {
    expect(() => decrypt('apenas-uma-parte')).toThrow('formato inválido');
  });

  it('decrypt rejeita conteúdo adulterado (auth tag não confere)', () => {
    const enc = encrypt('abc');
    const [iv, tag, data] = enc.split(':');
    const adulterado = `${iv}:${tag}:${data.slice(0, -2)}00`;
    expect(() => decrypt(adulterado)).toThrow();
  });

  it('cai no NEXTAUTH_SECRET quando DISCORD_TOKEN_ENC_KEY está ausente', () => {
    delete process.env.DISCORD_TOKEN_ENC_KEY;
    const enc = encrypt('y');
    expect(decrypt(enc)).toBe('y');
  });

  it('lança quando nenhuma chave está definida', () => {
    delete process.env.DISCORD_TOKEN_ENC_KEY;
    delete process.env.NEXTAUTH_SECRET;
    expect(() => encrypt('z')).toThrow('DISCORD_TOKEN_ENC_KEY');
  });
});
