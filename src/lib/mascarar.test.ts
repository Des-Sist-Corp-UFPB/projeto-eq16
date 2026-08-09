import { describe, it, expect } from 'vitest';
import { mascararIp, resumirUserAgent } from '@/lib/mascarar';

describe('mascararIp', () => {
  it('mantém só a rede em IPv4', () => {
    expect(mascararIp('189.45.201.77')).toBe('189.45.•••.•••');
    expect(mascararIp('10.0.0.1')).toBe('10.0.•••.•••');
  });

  it('mantém só os dois primeiros grupos em IPv6', () => {
    expect(mascararIp('2804:14d:5c81:8f1d::1')).toBe('2804:14d:•••');
  });

  it('censura por completo formatos que não reconhece', () => {
    expect(mascararIp('algo-estranho')).toBe('••••••');
  });

  it('retorna null para ausente ou vazio', () => {
    expect(mascararIp(null)).toBeNull();
    expect(mascararIp(undefined)).toBeNull();
    expect(mascararIp('   ')).toBeNull();
  });

  it('nunca deixa vazar o valor original', () => {
    const ip = '189.45.201.77';
    expect(mascararIp(ip)).not.toContain('201');
    expect(mascararIp(ip)).not.toContain('77');
  });
});

describe('resumirUserAgent', () => {
  it('resume navegador e sistema sem expor versões', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const resumo = resumirUserAgent(ua);
    expect(resumo).toBe('Chrome · Windows');
    expect(resumo).not.toContain('120.0');
    expect(resumo).not.toContain('537.36');
  });

  it('prefere Edge sobre Chrome quando ambos aparecem', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    expect(resumirUserAgent(ua)).toBe('Edge · Windows');
  });

  it('reconhece iOS e Safari', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Safari/604.1';
    expect(resumirUserAgent(ua)).toBe('Safari · iOS');
  });

  it('cai para "desconhecido" quando não identifica nada', () => {
    expect(resumirUserAgent('xyz')).toBe('desconhecido');
  });

  it('retorna null para ausente ou vazio', () => {
    expect(resumirUserAgent(null)).toBeNull();
    expect(resumirUserAgent('')).toBeNull();
    expect(resumirUserAgent('  ')).toBeNull();
  });
});
