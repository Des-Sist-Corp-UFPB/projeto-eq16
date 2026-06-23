# ⚔️ Rinha Team Finder

**Encontre jogadores e monte seu time para a Rinha do Campus IV — Edição II**

Aplicação web full-stack para conectar jogadores (Free Agents) e equipes da competição de **League of Legends** da **Rinha do Campus IV**.

---

## 📖 Sobre o Projeto

O **Rinha Team Finder** é uma plataforma onde jogadores anunciam que estão disponíveis e equipes anunciam suas vagas em aberto — cada um encontra o outro pelas **rotas (lanes)** que precisa. O contato final é feito pelo **Discord** da comunidade.

A experiência é dividida em **duas personas**, com identidade visual própria:

- 🔵 **Jogador (Free Agent)** — cor **ciano**
- 🔴 **Equipe** — cor **rosa**

---

## ✨ Funcionalidades

### 👤 Free Agent (jogador buscando equipe)
- Cadastro com **nickname**, **rota principal** e **rota secundária**. O contato do Discord vem da **conta vinculada** (não é mais digitado à mão).
- **Regra do Fill:** se a rota principal for **Fill**, o jogador joga qualquer rota e a **secundária deixa de ser pedida** (some do formulário).
- **Apenas um free agent por conta** — para criar outro, é preciso remover o atual.

### 🛡️ Equipe (buscando jogadores)
- Cadastro com **nome**, **nickname do capitão** e as **vagas abertas**. O Discord do capitão vem da **conta vinculada**.
- **De 1 a 5 vagas** — toda equipe precisa ter **ao menos uma vaga** aberta.
- Edição e remoção das próprias equipes.
- Ao criar a equipe, um **canal privado no Discord** é criado automaticamente (quando o bot está configurado).

### 🤖 Integração com Discord
- **Login com Discord** (além do usuário/senha): o primeiro login cria a conta automaticamente, sem senha.
- **Vínculo obrigatório:** para cadastrar equipe ou virar free agent, é preciso ter o Discord vinculado — a identidade real (`discordId`) substitui o texto livre antigo. Um **banner** lembra quem ainda não vinculou.
- **"Solicitar entrada":** o free agent escolhe uma vaga aberta e o bot o adiciona ao canal privado da equipe, avisando o capitão.
- **Candidaturas:** o capitão vê quem solicitou cada vaga e pode **aceitar/recusar** pelo site. Ao aceitar, a vaga fecha, os outros candidatos àquela lane são recusados e o jogador some das demais vagas da equipe.
- Tudo que toca o Discord é **best-effort**: sem o bot configurado, o site funciona normalmente (as ações ficam só no banco).

### 🔎 Listagens e filtros
- Páginas de **Equipes** e **Free Agents** são **públicas** (qualquer um navega).
- **Filtro por rota**: seletor de chips, **desmarcado por padrão**, permite escolher **até 2 rotas**. Mostra apenas quem tem aquela(s) rota(s) — equipes pelas vagas, jogadores pela rota principal/secundária.

### 🔗 Nicknames e contato
- O **nickname** segue o formato `Nome#TAG` (a TAG após o `#` tem **no máximo 5 caracteres**). Ex.: `Chico kit lasca#Chico`. É exibido **exatamente como o usuário digitou** (sem caixa alta forçada).
- O nickname (do jogador e do capitão) é **clicável** e abre o perfil no **[League of Graphs](https://www.leagueofgraphs.com/)** — solução temporária até integrarmos a API oficial da Riot.
- O **contato é via Discord** vinculado à conta. O chip do Discord nos cards é **copiável** (um clique copia o usuário).

### 🔒 Acesso aos contatos (privacidade)
- As listagens são públicas, mas **ver/copiar o contato exige login**. Deslogado, o chip do Discord aparece como **"entre para ver"** e leva à tela de login (que devolve à página de origem). O nickname → League of Graphs continua público (é perfil de jogo, não contato).

### 🛠️ Gestão e permissões
- Cada usuário gerencia **seus próprios** anúncios (editar/excluir).
- **ADMIN** pode remover qualquer anúncio.
- Área **Minha Conta** com menu lateral: **Perfil**, **Contas Vinculadas** (gerenciar o Discord) e **Segurança** (trocar a senha, sair).

### 🎨 Experiência / Design
- **Home "Split Path"**: duas jornadas lado a lado (Jogador × Equipe), com ações primárias em destaque e atalhos secundários.
- **Cores por persona** aplicadas de forma sóbria nas listagens, na navbar (hover/aba ativa) e nos modais.
- **Iluminação de fundo (vinheta)** em cada listagem, na cor da persona.
- Badge da home leva à **página oficial do torneio**.
- Atalhos para o **Servidor do Discord** e o **Grupo do WhatsApp** da comunidade.

> Links e regras (convite do Discord, grupo do WhatsApp, base do League of Graphs e o regex do nickname) ficam centralizados em [`src/constants/links.ts`](src/constants/links.ts).

---

## 📋 Regras de Negócio (resumo)

| Regra | Onde é validada |
| ----- | --------------- |
| Nickname no formato `Nome#TAG` (TAG ≤ 5) | Formulário + API (jogador e capitão) |
| Free Agent: 1 por conta | API (`POST /api/free-agents` → 409) |
| Free Agent Fill: sem rota secundária | Formulário + API + banco (`laneSecundaria` opcional) |
| Equipe: 1 a 5 vagas, no mínimo 1 | Formulário + API |
| Editar/excluir: dono ou ADMIN | API |
| Contato (Discord) só logado | UI dos cards |
| Discord vinculado p/ cadastrar/solicitar | API (checa `discordId` no banco) |
| Solicitar entrada: lane tem que estar aberta | API (`POST /api/equipes/[id]/solicitar`) |
| Aceitar/recusar candidatura: só capitão/ADMIN | API + núcleo `lib/candidaturas.ts` |

---

## 🛠️ Tecnologias Utilizadas

| Camada           | Tecnologia                                                                  |
| ---------------- | --------------------------------------------------------------------------- |
| **Framework**    | [Next.js 16](https://nextjs.org/) (App Router)                              |
| **Linguagem**    | [TypeScript 5](https://www.typescriptlang.org/)                            |
| **UI**           | [React 19](https://react.dev/) + [Tailwind CSS 4](https://tailwindcss.com/) |
| **Autenticação** | [NextAuth.js v4](https://next-auth.js.org/) (Credentials + **Discord OAuth** + JWT) |
| **ORM**          | [Prisma 7](https://www.prisma.io/) (com `prisma.config.ts`)               |
| **Banco**        | [PostgreSQL 16](https://www.postgresql.org/)                              |
| **Hospedagem**   | [Vercel](https://vercel.com/) (produção)                                  |
| **Banco local**  | [Docker](https://www.docker.com/) (apenas em desenvolvimento)             |

---

## 📁 Estrutura do Projeto

```
rinha-team-finder/
├── prisma/
│   ├── migrations/             # Migrations do banco de dados
│   ├── schema.prisma           # Schema do Prisma (modelos e enums)
│   └── seed.ts                 # Script de seed (usuário admin)
├── src/
│   ├── app/
│   │   ├── api/                # Rotas REST (auth, equipes, free-agents, usuarios)
│   │   ├── auth/               # Login e registro
│   │   ├── conta/              # Conta do usuário (trocar senha)
│   │   ├── equipes/            # Listagem de equipes
│   │   ├── freeagents/         # Listagem de free agents
│   │   ├── inicio/             # Home (Split Path)
│   │   └── ping/               # Health check (opcional)
│   ├── components/
│   │   ├── Navbar.tsx              # Navegação (cores por persona)
│   │   ├── EquipeInfoResume.tsx    # Card de equipe
│   │   ├── FreeAgentInfoResume.tsx # Card de free agent
│   │   ├── LaneFilter.tsx          # Filtro de rotas (multi-select, até 2)
│   │   ├── PositionSelector.tsx    # Seletor radial de lanes (accent ciano/rosa)
│   │   ├── PageGlow.tsx            # Iluminação de fundo das listagens
│   │   └── modals/                 # Cadastro, edição, confirmação, sucesso
│   ├── constants/
│   │   ├── links.ts            # Discord, WhatsApp, League of Graphs e regex do nickname
│   │   └── positions.ts        # Lanes/posições
│   ├── lib/                    # NextAuth e Prisma Client
│   └── types/                  # Tipagens TypeScript
├── prisma.config.ts            # Configuração do Prisma 7 (datasource)
├── docker-compose.yml          # Banco PostgreSQL para desenvolvimento local
├── .env.example                # Modelo de variáveis de ambiente
└── next.config.ts
```

---

## 🗃️ Banco de Dados

**Enums:**
- **`Role`** — `USER` | `ADMIN`
- **`Lane`** — `TOP` | `JUNGLE` | `MID` | `ADC` | `SUPPORT` | `FILL`
- **`StatusEquipe`** — `ABERTA` | `COMPLETA`
- **`StatusCandidatura`** — `PENDENTE` | `ACEITA` | `RECUSADA`

**Modelos:**

| Modelo        | Descrição                 | Campos Principais                                                                                          |
| ------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `User`        | Usuário autenticado       | `username`, `password?` (hash, opcional), `role`, `discordId?` (snowflake), `discordUsername?`, tokens OAuth cifrados |
| `FreeAgent`   | Jogador buscando equipe   | `nickname`, `lanePrincipal`, `laneSecundaria?` (opcional)                                                  |
| `Equipe`      | Equipe buscando jogadores | `nome`, `nicknameCapitao`, `vagasLanes[]`, `discordChannelId?`, `status`                                   |
| `Candidatura` | Pedido de entrada numa vaga | `lane`, `status`, `equipeId`, `userId` — único por `(equipeId, userId, lane)`                            |

- `laneSecundaria` é **opcional** (jogadores Fill não têm secundária).
- `password` é **opcional**: contas criadas via **login do Discord** não têm senha local.
- O contato (Discord) deixou de ser texto livre em `FreeAgent`/`Equipe` — a verdade agora é `User.discordId`/`discordUsername`.
- Ao deletar um `User`, todos os seus registros (inclusive candidaturas) são removidos em cascata (`onDelete: Cascade`).

---

## 🔐 Autenticação

Autenticação via **NextAuth.js v4** com estratégia **JWT** e dois providers: **Credentials** (usuário/senha) e **Discord OAuth**:

1. O usuário se cadastra em `/auth/registro` (senha com hash `bcryptjs`) **ou** entra direto com **"Entrar com Discord"** — o primeiro login via Discord cria a conta automaticamente, sem senha.
2. O login é feito em `/auth/login` (respeita `?redirect=` para voltar à página de origem).
3. Sessões são gerenciadas via JWT (sem banco de sessões).
4. O token JWT contém: `id`, `username`, `role` e o vínculo do Discord (`discordId`, `discordUsername`, `discordLinked`).
5. **Vincular o Discord** é obrigatório para cadastrar equipe/free agent — feito no login com Discord ou em **Minha Conta → Contas Vinculadas** (OAuth: `/api/discord/link` → `/api/discord/callback`).

> ⚠️ Hoje, login usuário/senha e depois "Entrar com Discord" criam **contas separadas** (não há email em comum para fundir). Pendência conhecida — ver o markdown da integração com Discord.

---

## 🚀 Como Rodar Localmente

O perfil de desenvolvimento roda a **aplicação na sua máquina** (`npm run dev`) e o
**banco em Docker** — assim você não precisa instalar PostgreSQL nem usar o pgAdmin.

### Pré-requisitos

- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (para o banco)

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env        # Linux/Mac
# ou, no PowerShell:
Copy-Item .env.example .env
```

Os valores padrão do `.env.example` já batem com o `docker-compose.yml`, então
normalmente não é preciso alterar nada para desenvolver localmente.

> ⚠️ Se a porta **5432** já estiver em uso (ex.: um PostgreSQL instalado na máquina),
> defina `DB_PORT` (ex.: `5433`) no `.env` e ajuste a porta no `DATABASE_URL`.

### 3. Suba o banco (Docker)

```bash
npm run db:up        # equivale a: docker compose up -d
```

### 4. Aplique as migrations (e gere o cliente Prisma)

```bash
npm run db:migrate   # equivale a: prisma migrate dev
```

### 5. (Opcional) Crie o usuário admin

```bash
npx prisma db seed
```

### 6. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

Para parar o banco: `npm run db:down` (mantém os dados) ou `docker compose down -v` (apaga os dados).

---

## ☁️ Deploy na Vercel

1. Importe o repositório na [Vercel](https://vercel.com/new).
2. Configure um banco PostgreSQL (Vercel Postgres, Neon, Supabase, etc.) e copie a connection string.
3. Defina as variáveis de ambiente do projeto (veja a tabela abaixo).
4. A Vercel roda o `build` automaticamente — o script já executa
   `prisma generate && prisma migrate deploy && next build`, aplicando as migrations no deploy.

> O `postinstall` (`prisma generate`) garante que o Prisma Client seja gerado após o `npm install`.

---

## ⚙️ Variáveis de Ambiente

| Variável          | Descrição                         | Exemplo                                          |
| ----------------- | --------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`    | Connection string do PostgreSQL   | `postgresql://rinha:rinha@localhost:5432/rinha`  |
| `NEXTAUTH_SECRET` | Chave secreta para assinar os JWT | `uma-string-aleatoria-longa`                     |
| `NEXTAUTH_URL`    | URL base da aplicação             | `http://localhost:3000` / URL da Vercel          |

**Discord (integração):**

| Variável                    | Descrição                                                              | Obrigatória? |
| --------------------------- | --------------------------------------------------------------------- | ------------ |
| `DISCORD_CLIENT_ID`         | Client ID da aplicação Discord (login + vínculo)                      | p/ Discord   |
| `DISCORD_CLIENT_SECRET`     | Client Secret da aplicação Discord                                    | p/ Discord   |
| `DISCORD_TOKEN_ENC_KEY`     | Chave p/ cifrar os tokens OAuth no banco (`openssl rand -hex 32`)     | recomendada (cai em `NEXTAUTH_SECRET`) |
| `DISCORD_BOT_TOKEN`         | Bot Token — necessário p/ auto-join e canais privados                 | p/ canais    |
| `DISCORD_GUILD_ID`          | ID do servidor (guild) onde o bot atua                                | p/ canais    |
| `DISCORD_TEAMS_CATEGORY_ID` | (Opcional) categoria p/ agrupar os canais das equipes                 | não          |

> No app do Discord (OAuth2), cadastre **dois redirects**: `${NEXTAUTH_URL}/api/auth/callback/discord` (login) e `${NEXTAUTH_URL}/api/discord/callback` (vínculo). O bot precisa estar no servidor com permissão **"Gerenciar Canais"**. Sem essas variáveis, o site funciona normalmente — as ações do Discord viram no-op.

Variáveis usadas **apenas** pelo `docker-compose.yml` local (opcionais, têm defaults):
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DB_PORT`.

---

## 🏗️ Configuração do Prisma 7

O projeto usa o **Prisma 7** com `prisma.config.ts`:

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});
```

> O `schema.prisma` não contém a `url` diretamente (padrão do Prisma 7). A URL vem do
> `prisma.config.ts`, que lê de `process.env.DATABASE_URL`.

---

## 📡 Principais Rotas da API

| Método   | Rota                     | Acesso        | Descrição                                  |
| -------- | ------------------------ | ------------- | ------------------------------------------ |
| `GET`    | `/api/equipes`           | Público       | Lista equipes                              |
| `POST`   | `/api/equipes`           | Autenticado   | Cria equipe (≥ 1 vaga)                     |
| `PUT`    | `/api/equipes/[id]`      | Dono/ADMIN    | Atualiza equipe                            |
| `DELETE` | `/api/equipes/[id]`      | Dono/ADMIN    | Remove equipe                              |
| `GET`    | `/api/free-agents`       | Público       | Lista free agents                          |
| `POST`   | `/api/free-agents`       | Autenticado + Discord | Cria free agent (1 por conta)      |
| `DELETE` | `/api/free-agents/[id]`  | Dono/ADMIN    | Remove free agent                          |
| `GET/POST` | `/api/equipes/[id]/solicitar` | Autenticado + Discord | Lanes já solicitadas / solicita uma vaga |
| `GET`    | `/api/equipes/[id]/candidaturas` | Dono/ADMIN | Candidaturas recebidas da equipe       |
| `PATCH`  | `/api/candidaturas/[id]` | Dono/ADMIN    | Aceita ou recusa uma candidatura           |
| `GET`    | `/api/discord/link`      | Autenticado   | Inicia o vínculo do Discord (OAuth)        |
| `GET`    | `/api/discord/callback`  | Autenticado   | Callback do vínculo                        |
| `POST`   | `/api/discord/unlink`    | Autenticado   | Desvincula o Discord                        |
| `GET`    | `/api/usuarios/me`       | Autenticado   | Dados do perfil do usuário logado          |
| `*`      | `/api/auth/[...nextauth]`| —             | Login/logout (NextAuth: Credentials + Discord) |
| `GET`    | `/ping`                  | Público       | Health check                               |
