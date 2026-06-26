# 🤖 Configuração do Discord (app, bot, OAuth e Interactions)

Guia prático para deixar a integração com o Discord **100% funcional** — tanto no
seu ambiente local quanto no servidor do professor. Tudo que toca o Discord
**degrada graciosamente**: sem as variáveis abaixo, o site funciona normalmente,
só não cria canais nem responde aos botões.

> **Resumo das variáveis** (todas vão no `.env` local e nas envs do servidor):
>
> | Variável | Para quê | Onde achar |
> |---|---|---|
> | `DISCORD_CLIENT_ID` | OAuth (login + vínculo) | Aba **OAuth2** do app |
> | `DISCORD_CLIENT_SECRET` | OAuth (troca do code por token) | Aba **OAuth2** → *Reset Secret* |
> | `DISCORD_PUBLIC_KEY` | Validar assinatura dos botões | Aba **General Information** |
> | `DISCORD_BOT_TOKEN` | Criar canais, postar painel, mover gente | Aba **Bot** → *Reset Token* |
> | `DISCORD_GUILD_ID` | Servidor onde tudo acontece | Botão direito no servidor → *Copiar ID* |
> | `DISCORD_TEAMS_CATEGORY_ID` | (opcional) agrupar os canais das equipes | Botão direito na categoria → *Copiar ID* |
> | `DISCORD_TOKEN_ENC_KEY` | Cifrar tokens OAuth no banco | Você gera: `openssl rand -hex 32` |

---

## 1. Criar a sua própria aplicação Discord

Como as credenciais atuais são da conta de outra pessoa, o caminho mais rápido e
**100% sob seu controle** é criar a **sua** aplicação para desenvolver/testar. A
app do colega continua valendo para produção (veja a seção 7 sobre compartilhar).

1. Acesse <https://discord.com/developers/applications> e clique **New Application**.
2. Dê um nome (ex.: `Rinha Team Finder (dev)`) e crie.
3. Na aba **General Information**, copie a **Public Key** → `DISCORD_PUBLIC_KEY`.

## 2. Criar um servidor de testes (guild)

1. No app do Discord (cliente normal), crie um servidor só seu (`+` → *Criar o meu*).
2. Ative o **Modo de Desenvolvedor**: *Configurações de Usuário → Avançado → Modo de Desenvolvedor*.
3. Clique com o botão direito no nome do servidor → **Copiar ID do Servidor** → `DISCORD_GUILD_ID`.
4. (Opcional) Crie uma **categoria** "Equipes", botão direito nela → *Copiar ID* → `DISCORD_TEAMS_CATEGORY_ID`.

## 3. Configurar o Bot

1. No app (developer portal), aba **Bot** → o bot já existe; clique **Reset Token**,
   confirme e copie → `DISCORD_BOT_TOKEN`. **Guarde com cuidado — é uma senha.**
2. Role até **Privileged Gateway Intents** — para o nosso uso (REST + Interactions)
   **não precisa** ligar nenhum intent privilegiado.

## 4. OAuth2 — login e vínculo de conta

1. Aba **OAuth2** → copie o **Client ID** → `DISCORD_CLIENT_ID`.
2. **Reset Secret** → copie → `DISCORD_CLIENT_SECRET`.
3. Em **Redirects**, adicione **os dois** (troque a base conforme o ambiente):
   - `http://localhost:3000/api/auth/callback/discord`  ← login "Entrar com Discord"
   - `http://localhost:3000/api/discord/callback`         ← vínculo em *Minha Conta*

   No servidor do professor, troque por `https://SEU-SUBDOMINIO/api/auth/callback/discord`
   e `https://SEU-SUBDOMINIO/api/discord/callback`. Pode cadastrar localhost **e** o
   domínio de produção ao mesmo tempo.

## 5. Convidar o bot para o servidor (com a permissão certa)

1. Aba **OAuth2 → URL Generator**.
2. Em **Scopes** marque `bot`.
3. Em **Bot Permissions** marque **as duas**:
   - **Manage Channels** (Gerenciar Canais) — criar/excluir o canal da equipe.
   - **Manage Roles** (Gerenciar Cargos) — **liberar/revogar o acesso dos membros**
     ao canal. O Discord exige `Manage Roles` para editar as permissões de um
     membro num canal (`PUT .../channels/{id}/permissions/{userId}`); só Manage
     Channels **não** basta — o canal é criado, mas ninguém é adicionado depois.

   (Para um ambiente de testes, marcar **Administrator** cobre as duas de uma vez.)
4. Copie a URL gerada, abra no navegador, escolha o seu servidor de testes e autorize.

> Se já convidou o bot só com Manage Channels, não precisa reconvidar: vá em
> *Configurações do servidor → Cargos →* cargo do bot e ligue **Gerenciar Cargos**.

## 6. Interactions Endpoint (os botões Aceitar/Recusar)

O Discord precisa de uma **URL pública** para entregar os cliques de botão. No
servidor do professor isso já existe (o subdomínio). No **localhost**, use um túnel.

### 6.1. Subir um túnel para o localhost

Com o `npm run dev` rodando na porta 3000, abra outro terminal:

```bash
# Opção A — cloudflared (não precisa de conta)
cloudflared tunnel --url http://localhost:3000

# Opção B — ngrok (precisa de conta grátis + authtoken)
ngrok http 3000
```

Ambos imprimem uma URL pública tipo `https://algo-aleatorio.trycloudflare.com`.

### 6.2. Registrar a URL no Discord

1. Aba **General Information** do app → campo **Interactions Endpoint URL**.
2. Cole `https://SUA-URL-PUBLICA/api/discord/interactions` e **Save Changes**.
3. O Discord envia na hora um `PING`; se a `DISCORD_PUBLIC_KEY` estiver certa no
   `.env`, ele aceita (✅). Se reclamar, confira a Public Key e reinicie o `npm run dev`.

> ⚠️ A URL do `cloudflared`/`ngrok` **muda** a cada vez que você sobe o túnel — é só
> reabrir esta tela e colar a nova. Em produção a URL é fixa, configura uma vez só.

### 6.3. Testar o fluxo completo

1. No site (logado e com Discord vinculado), **crie uma equipe** → um canal privado
   aparece no servidor.
2. Com **outra conta**, faça *Solicitar entrada* numa vaga → o bot joga essa conta no
   canal e posta o painel **Aceitar / Recusar**.
3. Como capitão, clique **Aceitar** → a vaga some do site, os outros candidatos àquela
   lane são recusados, e o painel vira "✅ Candidatura aceita!". Cada clique também
   gera um evento no **Log de Auditoria** (`/admin/auditoria`).

---

## 7. Como pedir ao seu amigo para compartilhar o app de produção

Se a ideia for vocês dois terem **acesso total ao mesmo app** (o de produção), o
Discord tem o recurso de **Teams**. Peça para ele:

1. Em <https://discord.com/developers/teams>, clicar **New Team** e criar um time.
2. Abrir o app atual em **Applications → (o app) → Settings → transfer/own**, e
   **transferir o app para o Team** (em *General Information* há a opção de mudar o
   dono do app para um Team).
3. No Team, aba **Team Members → Invite Member**, convidar o seu e-mail/usuário com o
   papel **Admin** (Admin enxerga e reseta secrets/token; Developer tem acesso mais
   limitado).
4. Você aceita o convite e passa a ver o app em *Applications*, com acesso ao
   Client Secret, Bot Token e Public Key.

> Mesmo com acesso compartilhado ao app de produção, para **testar local** continua
> valendo ter o seu próprio app de dev (seção 1) — assim você não mexe nas credenciais
> de produção enquanto desenvolve.

---

## 8. Onde colocar as variáveis

- **Local:** no arquivo `.env` (já existe um modelo em `.env.example`). Reinicie o
  `npm run dev` após editar.
- **Servidor do professor:** no `~/app/.env` do servidor + no bloco `environment:` do
  `docker-compose.yml` de lá (o CI **não** injeta envs).
- **Vercel (se usar):** em *Project Settings → Environment Variables*.
