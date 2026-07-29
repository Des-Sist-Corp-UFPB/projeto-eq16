import { describe, it, expect } from 'vitest';
import { UMAMI_SCRIPT_URL, umamiHabilitado } from '@/constants/analytics';

describe('UMAMI_SCRIPT_URL', () => {
  it('aponta para o painel da disciplina', () => {
    expect(UMAMI_SCRIPT_URL).toBe('https://umami.dsc.rodrigor.com/script.js');
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
