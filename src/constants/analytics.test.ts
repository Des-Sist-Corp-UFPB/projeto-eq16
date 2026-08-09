import { describe, it, expect } from 'vitest';
import { UMAMI_SCRIPT_URL, UMAMI_WEBSITE_ID, umamiHabilitado } from '@/constants/analytics';

describe('UMAMI_SCRIPT_URL', () => {
  it('aponta para o painel da disciplina', () => {
    expect(UMAMI_SCRIPT_URL).toBe('https://umami.dsc.rodrigor.com/script.js');
  });
});

describe('UMAMI_WEBSITE_ID', () => {
  // Guarda-chuva contra o modo de falha silencioso: se alguém apagar o id, a
  // medição some sem erro nenhum (build passa, deploy roda, painel zera).
  it('está configurado com o UUID do site', () => {
    expect(UMAMI_WEBSITE_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe('umamiHabilitado', () => {
  it('liga só em produção com o id configurado', () => {
    expect(umamiHabilitado('abc-123', 'production')).toBe(true);
  });

  it('não mede em desenvolvimento nem em teste (não polui o painel)', () => {
    expect(umamiHabilitado('abc-123', 'development')).toBe(false);
    expect(umamiHabilitado('abc-123', 'test')).toBe(false);
    expect(umamiHabilitado('abc-123', undefined)).toBe(false);
  });

  it('sem id configurado, fica desligado mesmo em produção', () => {
    expect(umamiHabilitado('', 'production')).toBe(false);
    expect(umamiHabilitado('   ', 'production')).toBe(false);
  });
});
