import { describe, it, expect } from 'vitest';
import { isNicknameValido, buildLeagueOfGraphsUrl } from '@/constants/links';

describe('isNicknameValido', () => {
  it('aceita Nome#TAG válido (com espaços no nome)', () => {
    expect(isNicknameValido('Chico#BR1')).toBe(true);
    expect(isNicknameValido('Chico kit lasca#Chico')).toBe(true);
  });

  it('faz trim antes de validar', () => {
    expect(isNicknameValido('  Foo#BR1  ')).toBe(true);
  });

  it('rejeita nickname sem #', () => {
    expect(isNicknameValido('SemTag')).toBe(false);
  });

  it('rejeita TAG com mais de 5 caracteres', () => {
    expect(isNicknameValido('Foo#TOOLONG')).toBe(false);
  });

  it('rejeita TAG vazia', () => {
    expect(isNicknameValido('Foo#')).toBe(false);
  });

  it('rejeita TAG não-alfanumérica', () => {
    expect(isNicknameValido('Foo#A-1')).toBe(false);
  });
});

describe('buildLeagueOfGraphsUrl', () => {
  it('monta a URL trocando espaços por + e # por -', () => {
    expect(buildLeagueOfGraphsUrl('Chico kit lasca#Chico')).toBe(
      'https://www.leagueofgraphs.com/summoner/br/Chico+kit+lasca-Chico'
    );
  });

  it('retorna null para nickname inválido', () => {
    expect(buildLeagueOfGraphsUrl('invalido')).toBeNull();
  });
});
