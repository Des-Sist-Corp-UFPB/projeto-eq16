import { describe, it, expect } from 'vitest';
import {
  mascararIp,
  resumirUserAgent,
  ehChaveSensivel,
  ehChaveSegredo,
  redigirMetadata,
  VALOR_CENSURADO,
  VALOR_REMOVIDO,
} from '@/lib/mascarar';

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

describe('ehChaveSensivel / ehChaveSegredo', () => {
  it('reconhece dado pessoal independente da grafia da chave', () => {
    for (const k of ['discordId', 'discord_id', 'DISCORD-ID', 'discordUsername', 'email', 'cpf']) {
      expect(ehChaveSensivel(k), k).toBe(true);
    }
  });

  it('não confunde chaves de negócio com dado pessoal', () => {
    // "equipeId" contém "ip" — o casamento é por chave inteira, não substring.
    for (const k of ['equipeId', 'equipeNome', 'lane', 'nome', 'status', 'porAdmin', 'via']) {
      expect(ehChaveSensivel(k), k).toBe(false);
      expect(ehChaveSegredo(k), k).toBe(false);
    }
  });

  it('reconhece segredo por fragmento em qualquer posição', () => {
    for (const k of ['accessToken', 'refresh_token', 'senhaNova', 'passwordHash', 'apiKey']) {
      expect(ehChaveSegredo(k), k).toBe(true);
    }
  });
});

describe('redigirMetadata', () => {
  // O caso real da trilha: metadata de discord.link / discord.unlink.
  const vinculo = { discordId: '123456789012345678', discordUsername: 'fulano#0' };

  it('censura dado pessoal no estado padrão e o devolve na versão revelável', () => {
    const { censurado, revelavel, temSensivel } = redigirMetadata(vinculo);
    expect(temSensivel).toBe(true);
    expect(censurado).toEqual({
      discordId: VALOR_CENSURADO,
      discordUsername: VALOR_CENSURADO,
    });
    expect(revelavel).toEqual(vinculo);
  });

  it('preserva os campos de negócio nas duas versões', () => {
    const meta = { equipeId: 'e1', equipeNome: 'Time X', lane: 'MID', ...vinculo };
    const { censurado, revelavel } = redigirMetadata(meta);
    for (const versao of [censurado, revelavel] as Record<string, unknown>[]) {
      expect(versao.equipeId).toBe('e1');
      expect(versao.equipeNome).toBe('Time X');
      expect(versao.lane).toBe('MID');
    }
  });

  it('remove segredos das DUAS versões — nem o olho revela', () => {
    const { censurado, revelavel, temSensivel } = redigirMetadata({
      accessToken: 'abc123',
      nome: 'Time X',
    });
    expect(censurado).toEqual({ accessToken: VALOR_REMOVIDO, nome: 'Time X' });
    expect(revelavel).toEqual({ accessToken: VALOR_REMOVIDO, nome: 'Time X' });
    // Segredo não é "revelável", então sozinho não acende o olho.
    expect(temSensivel).toBe(false);
  });

  it('censura em profundidade, dentro de objetos e arrays', () => {
    const { censurado } = redigirMetadata({
      convidados: [{ discordId: 'a1' }, { discordId: 'b2' }],
      aninhado: { interno: { email: 'x@y.z' } },
    });
    expect(JSON.stringify(censurado)).not.toContain('a1');
    expect(JSON.stringify(censurado)).not.toContain('b2');
    expect(JSON.stringify(censurado)).not.toContain('x@y.z');
  });

  it('não marca temSensivel quando o valor sensível é nulo', () => {
    const { censurado, temSensivel } = redigirMetadata({ discordId: null, nome: 'X' });
    expect(temSensivel).toBe(false);
    expect(censurado).toEqual({ discordId: null, nome: 'X' });
  });

  it('atravessa metadata sem nada sensível sem alterar nada', () => {
    const meta = { nome: 'Time X', vagasLanes: ['TOP', 'MID'], porAdmin: false };
    const { censurado, revelavel, temSensivel } = redigirMetadata(meta);
    expect(temSensivel).toBe(false);
    expect(censurado).toEqual(meta);
    expect(revelavel).toEqual(meta);
  });

  it('lida com metadata nulo ou primitivo', () => {
    expect(redigirMetadata(null).censurado).toBeNull();
    expect(redigirMetadata('texto').censurado).toBe('texto');
  });
});
