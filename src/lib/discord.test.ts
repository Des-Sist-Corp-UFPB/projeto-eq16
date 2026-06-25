import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchDiscordUser,
  addUserToGuild,
  encryptToken,
  createTeamChannel,
  addMemberToChannel,
  removeMemberFromChannel,
  postChannelMessage,
  deleteChannel,
} from '@/lib/discord';

const fetchMock = vi.fn();

function fakeRes(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
function lastBody() {
  const call = fetchMock.mock.calls.at(-1)!;
  return JSON.parse((call[1] as { body: string }).body);
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  process.env.DISCORD_CLIENT_ID = 'client-1';
  process.env.DISCORD_CLIENT_SECRET = 'secret-1';
  process.env.DISCORD_BOT_TOKEN = 'bot-token';
  process.env.DISCORD_GUILD_ID = 'guild-1';
  process.env.DISCORD_TOKEN_ENC_KEY = 'chave-de-teste';
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  delete process.env.DISCORD_TEAMS_CATEGORY_ID;
});

afterEach(() => vi.unstubAllGlobals());

describe('OAuth helpers', () => {
  it('buildAuthorizeUrl monta a URL com escopos e state', () => {
    const url = new URL(buildAuthorizeUrl('xyz'));
    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('state')).toBe('xyz');
    expect(url.searchParams.get('scope')).toBe('identify guilds.join');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/discord/callback');
  });

  it('buildAuthorizeUrl lança sem client id/secret', () => {
    delete process.env.DISCORD_CLIENT_ID;
    expect(() => buildAuthorizeUrl('x')).toThrow('não configurados');
  });

  it('exchangeCodeForToken retorna os tokens quando 200', async () => {
    fetchMock.mockResolvedValue(fakeRes(200, { access_token: 'a', refresh_token: 'r', expires_in: 60 }));
    const t = await exchangeCodeForToken('code-123');
    expect(t.access_token).toBe('a');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/oauth2/token',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('exchangeCodeForToken lança quando não-ok', async () => {
    fetchMock.mockResolvedValue(fakeRes(400));
    await expect(exchangeCodeForToken('bad')).rejects.toThrow();
  });

  it('fetchDiscordUser retorna o perfil quando 200', async () => {
    fetchMock.mockResolvedValue(fakeRes(200, { id: '42', username: 'foo', global_name: 'Foo' }));
    expect((await fetchDiscordUser('token')).id).toBe('42');
  });

  it('fetchDiscordUser lança quando não-ok', async () => {
    fetchMock.mockResolvedValue(fakeRes(401));
    await expect(fetchDiscordUser('token')).rejects.toThrow();
  });
});

describe('encryptToken', () => {
  it('cifra no formato iv:tag:cipher', () => {
    expect(encryptToken('abc').split(':')).toHaveLength(3);
  });
});

describe('addUserToGuild', () => {
  it("retorna 'skipped' sem bot token/guild", async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    expect(await addUserToGuild('u', 'tok')).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("201 → 'joined', 204 → 'already'", async () => {
    fetchMock.mockResolvedValueOnce(fakeRes(201));
    expect(await addUserToGuild('u', 'tok')).toBe('joined');
    fetchMock.mockResolvedValueOnce(fakeRes(204));
    expect(await addUserToGuild('u', 'tok')).toBe('already');
  });

  it('status inesperado lança', async () => {
    fetchMock.mockResolvedValue(fakeRes(500));
    await expect(addUserToGuild('u', 'tok')).rejects.toThrow();
  });
});

describe('createTeamChannel', () => {
  it('retorna null sem bot config', async () => {
    delete process.env.DISCORD_GUILD_ID;
    expect(await createTeamChannel('Time Alfa', 'cap')).toBeNull();
  });

  it('cria o canal negando @everyone e liberando o capitão', async () => {
    fetchMock.mockResolvedValue(fakeRes(201, { id: 'chan-1' }));
    const id = await createTeamChannel('Time Alfa', 'cap-id');
    expect(id).toBe('chan-1');
    const body = lastBody();
    expect(body.name).toBe('equipe-time-alfa');
    expect(body.type).toBe(0);
    expect(body.permission_overwrites).toHaveLength(2);
    // @everyone (role) negado, capitão (member) liberado
    expect(body.permission_overwrites[0]).toMatchObject({ id: 'guild-1', type: 0 });
    expect(body.permission_overwrites[1]).toMatchObject({ id: 'cap-id', type: 1 });
  });

  it('inclui parent_id quando há categoria', async () => {
    process.env.DISCORD_TEAMS_CATEGORY_ID = 'cat-9';
    fetchMock.mockResolvedValue(fakeRes(201, { id: 'c' }));
    await createTeamChannel('X', 'cap');
    expect(lastBody().parent_id).toBe('cat-9');
  });

  it('lança quando a API falha', async () => {
    fetchMock.mockResolvedValue(fakeRes(403));
    await expect(createTeamChannel('X', 'cap')).rejects.toThrow();
  });
});

describe('permissões e mensagens de canal', () => {
  it('addMemberToChannel reflete o ok da resposta', async () => {
    fetchMock.mockResolvedValue(fakeRes(204));
    expect(await addMemberToChannel('chan', 'd1')).toBe(true);
    fetchMock.mockResolvedValue(fakeRes(403));
    expect(await addMemberToChannel('chan', 'd1')).toBe(false);
  });

  it('addMemberToChannel retorna false sem bot token', async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    expect(await addMemberToChannel('chan', 'd1')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('removeMemberFromChannel reflete o ok da resposta', async () => {
    fetchMock.mockResolvedValue(fakeRes(204));
    expect(await removeMemberFromChannel('chan', 'd1')).toBe(true);
  });

  it('postChannelMessage envia só content sem components', async () => {
    fetchMock.mockResolvedValue(fakeRes(200));
    expect(await postChannelMessage('chan', 'oi')).toBe(true);
    expect(lastBody()).toEqual({ content: 'oi' });
  });

  it('postChannelMessage inclui components quando fornecidos', async () => {
    fetchMock.mockResolvedValue(fakeRes(200));
    await postChannelMessage('chan', 'oi', [{ type: 1 }]);
    expect(lastBody().components).toEqual([{ type: 1 }]);
  });

  it('deleteChannel é no-op sem bot token', async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    await deleteChannel('chan');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deleteChannel engole erro de rede (best-effort)', async () => {
    fetchMock.mockRejectedValue(new Error('rede caiu'));
    await expect(deleteChannel('chan')).resolves.toBeUndefined();
  });
});
