# 📄 Documentação — Recrutamento via Discord (Rinha Team Finder)

> Stack real do projeto: **Next.js 16 + TypeScript + Prisma 7 + NextAuth (Credentials) + PostgreSQL**, hospedado na **Vercel**.
> Esta documentação adapta a ideia de integração com Discord a esse stack (a referência genérica que circulou citava "aplicação Java" e bot sempre ligado — nada disso se aplica aqui).

## 1. Contexto e objetivo

Hoje a plataforma só **exibe** o usuário do Discord de cada free agent/capitão e manda todo mundo para um **servidor fixo**. O contato real depende das pessoas se acharem e se aceitarem manualmente — sem garantia de que saibam quem é quem.

**Objetivo:** automatizar o matchmaking. Quando uma equipe é criada, ela ganha um **canal privado** no Discord; um free agent clica em "Solicitar entrada" na listagem e o **bot o joga dentro desse canal**; lá o capitão decide, e ao fechar a vaga, a posição some da listagem **automaticamente**.

A **fonte da verdade das vagas continua no nosso banco** (campo `vagasLanes`). O Discord é só a interface de comunicação e de atualização.

---

## 2. Como está hoje (mapeado no código atual)

| Item | Estado atual | Arquivo/Modelo |
|---|---|---|
| Contato | String livre `discord` (só o texto do usuário, **não verificado**) | `FreeAgent.discord`, `Equipe.discord` em `prisma/schema.prisma` |
| Servidor | Convite fixo para todos | `DISCORD_INVITE_URL` em `src/constants/links.ts` |
| Vagas | Lista de lanes em aberto, sem rastrear quem ocupou | `Equipe.vagasLanes: Lane[]` |
| Login | Usuário/senha (Credentials + JWT) | `src/lib/auth.ts` |
| Gating | Listagem pública; chip de Discord só aparece logado | `EquipeInfoResume.tsx`, `FreeAgentInfoResume.tsx` |
| "Fechar vaga" | Capitão edita a equipe no site e remove a lane na mão | `EditarEquipe.tsx` + `PUT /api/equipes/[id]` |

**Limitação central:** nós só temos o **nome de usuário** do Discord (texto), e não a **identidade real** (o *snowflake* / ID do Discord). Sem o ID, um bot não consegue dar permissão de canal nem mencionar a pessoa.

---

## 3. A grande diferença de arquitetura para o nosso caso (Vercel)

A resposta genérica assume um bot sempre ligado (gateway WebSocket). **Na Vercel isso não roda** — funções serverless não mantêm conexão persistente. Mas o Discord oferece dois caminhos que se encaixam perfeitamente no nosso stack:

- **Ações que partem do site → Discord:** usar a **REST API do Discord** (HTTPS) direto das nossas API Routes (Next.js). Criar canal, dar/remover permissão e mandar mensagem são chamadas HTTP simples com um **Bot Token**. **Não precisa de processo sempre ligado.**
- **Ações que partem do Discord → site** (comandos/botões do capitão): usar o **Interactions Endpoint** do Discord. Registramos uma **URL de webhook** (uma API Route nossa, ex. `POST /api/discord/interactions`); o Discord faz POST nela a cada comando/clique. Validamos a assinatura **Ed25519** e respondemos. **Também serverless — sem bot 24/7.**

👉 **Recomendação:** começar sem nenhum processo persistente, usando **REST API + Interactions Endpoint**. Só migrar para um bot dedicado (discord.js em Railway/Render/Fly) se um dia precisarmos reagir a eventos que o webhook não cobre (ex.: detectar em tempo real quando alguém sai do servidor).

---

## 4. Mudanças no modelo de dados (Prisma)

**4.1. Vincular a identidade real do Discord no `User`:**
```prisma
model User {
  // ...campos atuais...
  discordId            String?   @unique   // snowflake real (essencial p/ o bot)
  discordUsername      String?             // para exibição
  discordAccessToken   String?             // OAuth (guilds.join) — guardar cifrado
  discordRefreshToken  String?
  discordTokenExpires  DateTime?
}
```

**4.2. Ligar a equipe ao canal e a um status:**
```prisma
enum StatusEquipe { ABERTA  COMPLETA }

model Equipe {
  // ...campos atuais...
  discordChannelId String?       // id do canal privado criado
  status           StatusEquipe @default(ABERTA)
}
```

**4.3. (Recomendado) Rastrear candidaturas** — hoje só guardamos posições, não quem está no canal. Para o bot saber a quem revogar permissão ao fechar uma vaga:
```prisma
enum StatusCandidatura { PENDENTE  ACEITA  RECUSADA }

model Candidatura {
  id        String @id @default(cuid())
  equipeId  String
  userId    String          // quem solicitou (já tem discordId)
  lane      Lane
  status    StatusCandidatura @default(PENDENTE)
  createdAt DateTime @default(now())
  // relations p/ Equipe e User
}
```
> Os campos `discord` (string) de `FreeAgent`/`Equipe` podem virar **legado/exibição**; a verdade passa a ser `User.discordId`.

---

## 5. Mudanças na autenticação (NextAuth)

Hoje é só Credentials. Precisamos **vincular o Discord** para conseguir `discordId` + token com escopo `guilds.join`.

- **Escopos OAuth2:** `identify` (pega o id/username) e `guilds.join` (permite o bot inserir a pessoa no servidor).
- **Caminho menos disruptivo** (usamos JWT sem adapter de banco): manter o login atual e adicionar um **fluxo manual de "Vincular Discord"**:
  1. Botão "Vincular Discord" → redireciona para a URL de autorização do Discord.
  2. Callback numa API Route nossa (`/api/discord/callback`): troca o `code` por tokens, busca o perfil (`/users/@me`), e salva `discordId`/tokens no `User` logado.
  3. Com o token, chama `PUT /guilds/{guild}/members/{userId}` (escopo `guilds.join`) para **colocar a pessoa no servidor automaticamente**.
- **Alternativa:** adicionar o **Discord provider** no NextAuth e tornar o Discord o login principal — mais limpo a longo prazo, mas exige adapter/migração de contas. Para não quebrar o que existe, sugiro o **fluxo de vínculo manual** primeiro.

**Regra nova:** estar logado **e** com Discord vinculado **e** dentro do servidor vira pré-requisito para "Solicitar entrada".

---

## 6. Os fluxos (adaptados ao nosso app)

**A. Criar equipe** (`POST /api/equipes`)
1. Salva a equipe com `vagasLanes` (como hoje).
2. Em seguida, via **REST do Discord**: cria um **canal privado** (`POST /guilds/{guild}/channels`, tipo texto, com `permission_overwrites` negando `@everyone` e liberando só o capitão pelo `discordId`).
3. Salva `discordChannelId` e `status = ABERTA` na equipe.

**B. Free agent solicita vaga** (novo: `POST /api/equipes/[id]/solicitar`)
1. Valida: logado + Discord vinculado + está no servidor + a lane ainda está em `vagasLanes`.
2. Cria `Candidatura(PENDENTE)`.
3. Via REST: adiciona `permission_overwrite` do `discordId` do FA no canal da equipe e posta: *"🎯 [Nick] entrou para testes na posição [Lane]!"*.
4. Na listagem, o botão de cada equipe vira **"Solicitar entrada"** (só para logados/vinculados), no lugar do convite fixo.

**C. Fechar vaga** (capitão, dentro do Discord) — detalhado na seção 7.

**D. Usuário sem equipe que quer recrutar:** mantém a regra — ele **cria a equipe primeiro** (fluxo já simples no site). Sem equipe, não há canal para onde levar o FA. ✅ Decisão correta, mantém o escopo enxuto.

---

## 7. Fechar a vaga — 3 níveis (com recomendação)

Como **só lidamos com posições** (não com o roster), "fechar vaga" = **remover a lane de `vagasLanes`** e, se zerar, `status = COMPLETA`. Isso é trivial. A diferença está em **como o capitão dispara** isso:

| Nível | Como funciona | Esforço dev | Esforço usuário |
|---|---|---|---|
| **1 — Manual (MVP)** | Capitão volta ao site e edita a equipe (já existe hoje) | Zero | Alto |
| **2 — Slash Command** | Capitão digita `/aceitar @user [lane]` no canal → Discord chama `POST /api/discord/interactions` → API remove a lane | Médio | Médio |
| **3 — Botões (recomendado)** | Ao solicitar, o bot posta um painel com botões ("Aceitar Top", "Aceitar Mid"…). O capitão clica → mesma rota de interactions → fecha a vaga e revoga as permissões dos outros candidatos àquela lane | Médio+ | Baixíssimo |

👉 **Sugestão:** entregar o **Nível 1 já** (funciona hoje, zero código) e mirar o **Nível 3** como objetivo, porque com a tabela `Candidatura` sabemos exatamente quais `discordId` remover do canal ao aceitar alguém. O Nível 2 é um bom degrau intermediário para validar o webhook de interactions antes dos botões.

**No backend, qualquer um dos níveis 2/3 cai na mesma lógica:**
```
recebe interação (valida assinatura Ed25519)
 → confirma que quem clicou é o capitão da equipe
 → remove a lane de vagasLanes (e atualiza Candidatura → ACEITA)
 → se vagasLanes vazio: status = COMPLETA
 → via REST: revoga permissão dos outros candidatos àquela lane no canal
 → responde a interação ("✅ Top preenchido!")
```

---

## 8. Segurança e sincronização

- **Assinatura das interações:** validar **sempre** o header `X-Signature-Ed25519` com a *public key* da app Discord; responder ao `PING` (type 1) com `PONG`. Sem isso, qualquer um forja requisições.
- **Quem clicou é o dono?** A interação traz o `discordId` de quem agiu — confirmar contra `Equipe.userId → User.discordId` antes de fechar a vaga.
- **Fonte da verdade:** o site manda no estado; o Discord só pede mudanças. Nunca confiar só na permissão do canal.
- **Idempotência:** aceitar a mesma lane duas vezes não pode quebrar (checar se a lane ainda está em `vagasLanes`).
- **Segredos:** `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID/SECRET`, `DISCORD_PUBLIC_KEY`, `DISCORD_GUILD_ID` nas variáveis de ambiente da Vercel. Tokens OAuth do usuário **cifrados** no banco.
- **Casos de borda:** pessoa que sai do servidor; equipe deletada (apagar o canal via REST); rate limits do Discord (tratar 429).

---

## 9. Roadmap sugerido (incremental)

1. **Fase 0 — Vínculo:** adicionar OAuth do Discord (escopos `identify`, `guilds.join`), salvar `discordId`, e auto-join no servidor. *(Já melhora tudo: contato vira identidade real.)*
2. **Fase 1 — Canais:** ao criar equipe, criar canal privado + `discordChannelId`. Botão da listagem vira **"Solicitar entrada"** → bot adiciona o FA no canal. Fechar vaga ainda manual (Nível 1).
3. **Fase 2 — Interactions:** criar `POST /api/discord/interactions`, registrar o slash command `/aceitar` (Nível 2). Validar assinatura e fechar vaga automática.
4. **Fase 3 — Botões + Candidaturas:** painel de botões (Nível 3) e a tabela `Candidatura` para revogar permissões dos demais e marcar `COMPLETA`.

---

## 10. Resumo das diferenças (de → para)

| | Hoje | Alvo |
|---|---|---|
| Identidade | username em texto | conta Discord vinculada (`discordId`) |
| Entrar no servidor | manual (convite fixo) | automático no login (`guilds.join`) |
| Achar a equipe | adicionar a pessoa na mão | clicar "Solicitar entrada" → cai no canal |
| Comunicação | DM aleatória | canal privado por equipe |
| Fechar vaga | editar no site | comando/botão no Discord → site atualiza sozinho |
| Infra Discord | nenhuma | REST API + Interactions webhook (serverless, **sem bot 24/7**) |

---

## 11. Recomendação final

Fazer **Fase 0 + Fase 1** primeiro (vínculo + canais + solicitar entrada, com fechamento manual). Isso já entrega ~80% do valor com risco baixo e **sem precisar de servidor de bot**. Depois evoluir para os botões (Fase 3). Manter a regra "**precisa criar equipe para recrutar**" — ela está correta e simplifica o modelo. E aproveitar que **só rastreamos posições**: fechar vaga é literalmente remover um item de `vagasLanes`, então o ganho de automação é alto com pouquíssima mudança de lógica.

---

## 12. ✅ O que foi feito

> Estado da implementação (junho/2026). O que estava "planejado" aqui já é **código**.

### Fase 0 — Vínculo + Login com Discord
- **`User`** ganhou `discordId @unique`, `discordUsername`, `discordAccessToken` / `discordRefreshToken` (cifrados com **AES-256-GCM** em `src/lib/crypto.ts`) e `discordTokenExpires`. O campo `password` virou **opcional**.
- Os campos `discord` (texto livre) foram **removidos** de `FreeAgent` e `Equipe` — a verdade do contato agora é `User.discordId`/`discordUsername`.
- **Vínculo manual:** `GET /api/discord/link` (gera `state` CSRF em cookie httpOnly → autoriza) e `GET /api/discord/callback` (troca o `code`, salva tokens cifrados, tenta auto-join e volta pra `/inicio?discord=...`). Helpers REST em `src/lib/discord.ts` (escopos `identify` + `guilds.join`).
- **Login "Entrar com Discord"** (provider do NextAuth): auto-cria a conta por `discordId` **sem senha** (username único derivado do nick). Convive com o login usuário/senha. Botão nas telas de login e registro (`DiscordLoginButton`).
- A sessão expõe `discordId` / `discordUsername` / `discordLinked` (reidratada via `update()`).
- **Obrigatoriedade do vínculo:** banner lateral `DiscordLinkBanner` + gate `VincularDiscordGate` nos cadastros; o enforcement real é no servidor (os `POST` checam `discordId` no banco).
- Chip do Discord nas listagens virou **copiável** (`DiscordChip`).
- Área **Minha Conta** reestruturada com menu lateral: **Perfil**, **Contas Vinculadas** (vincular / revincular / desvincular Discord) e **Segurança**.

### Fase 1 — Canais privados + Candidaturas
- **`Equipe`** ganhou `discordChannelId` e `status` (`StatusEquipe` = ABERTA/COMPLETA). Nova model **`Candidatura`** (`lane`, `status` PENDENTE/ACEITA/RECUSADA, `equipeId`, `userId`) com `@@unique([equipeId, userId, lane])` para idempotência.
- REST de canais em `src/lib/discord.ts`: `createTeamChannel` (nega `@everyone`, libera o capitão; opcional `DISCORD_TEAMS_CATEGORY_ID`), `addMemberToChannel`, `removeMemberFromChannel`, `postChannelMessage`, `deleteChannel`. **Tudo best-effort:** sem `DISCORD_BOT_TOKEN`/`DISCORD_GUILD_ID`, viram no-op e o site segue funcionando.
- `POST /api/equipes` cria o canal privado ao cadastrar a equipe; `DELETE /api/equipes/[id]` apaga o canal (candidaturas caem por cascade).
- **"Solicitar entrada"** (`POST /api/equipes/[id]/solicitar`): valida login + Discord + lane em `vagasLanes`, cria `Candidatura`, joga o FA no canal e posta *"🎯 [nick] entrou para testes na posição [lane]!"*. O modal mostra as lanes já pedidas como **"Já solicitado"**.
- **Capitão vê as candidaturas no site:** `GET /api/equipes/[id]/candidaturas` (só dono/admin) + modal `CandidaturasRecebidas` (nick→League of Graphs, Discord copiável, badge de status) + contagem no card via `_count`.
- **Fechar vaga no SITE** — núcleo compartilhado em `src/lib/candidaturas.ts` (`aceitarCandidatura` / `recusarCandidatura`), pronto para o Discord reusar depois. `PATCH /api/candidaturas/[id]` (`{ acao: 'aceitar' | 'recusar' }`, só capitão/admin):
  - **Aceitar:** remove uma ocorrência da lane de `vagasLanes`, marca ACEITA, **recusa os outros candidatos àquela vaga**, **remove as outras solicitações pendentes do próprio jogador na mesma equipe**, revoga o acesso dos recusados ao canal (bot) e, se zerar as vagas, `status = COMPLETA`.
  - **Recusar:** marca RECUSADA e tira a pessoa do canal; a vaga continua aberta.
  - Idempotente (reprocessar não quebra).

---

## 13. 🚧 O que falta fazer e próximos passos recomendados

1. **Fase 2/3 — aceitar/recusar pelo Discord (Interactions Endpoint).** Criar `POST /api/discord/interactions` validando a assinatura **Ed25519** (`DISCORD_PUBLIC_KEY`) e respondendo `PING → PONG`; postar um painel de **botões** no canal e, no clique, chamar o **mesmo núcleo** `src/lib/candidaturas.ts`. A lógica já existe — falta só a "casca". ⚠️ Para testar local, o Discord precisa alcançar o webhook: usar um **túnel** (ngrok/cloudflared), pois `localhost` não funciona.
2. **Configurar as credenciais/bot reais** (hoje tudo que toca o Discord roda como no-op): `DISCORD_CLIENT_ID/SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` e `DISCORD_PUBLIC_KEY`. Convidar o bot ao servidor com permissão **"Gerenciar Canais"**. No OAuth2 do app, cadastrar **dois redirects**: `/api/auth/callback/discord` (login) e `/api/discord/callback` (vínculo).
3. **Merge de contas por email (pendência conhecida).** Hoje fazer login usuário/senha e depois "Entrar com Discord" cria **duas contas** (não há chave em comum). Solução: coletar o email do Discord (scope `email`) + adicionar `email` na conta local e, no login via Discord, vincular à conta existente com o mesmo email.
4. **Cifragem em produção.** Definir `DISCORD_TOKEN_ENC_KEY` na Vercel (hoje cai em `NEXTAUTH_SECRET` como fallback).
5. **Refinos de produto (opcionais):** badge/filtro de equipes `COMPLETA` na listagem; avisar o capitão de novas candidaturas; tratar rate limit (429) do Discord; decidir o que fazer com o canal e as candidaturas quando a última vaga é preenchida.

> **Decisão registrada:** o **chat fica no Discord** — não vamos construir chat no site. Em LoL os times precisam de voz e todo mundo já está no Discord; um chat no site exigiria infra de tempo-real (o Vercel é serverless) e teria adoção baixa. O papel do site é **matchmaking + disparar ações**; o Discord é a **comunicação**.
