# teamfinder-mcp — Servidor MCP do Rinha Team Finder

Servidor **MCP (Model Context Protocol)** que expõe as operações centrais do
Rinha Team Finder como *tools* e *resources* para assistentes de IA (Claude
Desktop, Claude Code, Cursor, MCP Inspector...). Implementa a proposta do
[`MCP-IDEIA.md`](../MCP-IDEIA.md) (ver conceitos no [`MCP-TUTORIAL.md`](../MCP-TUTORIAL.md)).

## Arquitetura

```
┌──────────────┐   stdio    ┌────────────────┐   HTTP    ┌──────────────────┐
│ Assistente   │ ◄────────► │ teamfinder-mcp │ ────────► │ API do site      │
│ de IA        │  (MCP)     │ (mcp/server.ts)│           │ /api/free-agents │
└──────────────┘            │                │           │ /api/equipes     │
                            │                │   MCP     ┌──────────────────┐
                            │                │ ────────► │ op.gg MCP remoto │
                            └────────────────┘  (HTTP)   │ mcp-api.op.gg    │
                                                         └──────────────────┘
```

Dois princípios do professor, seguidos à risca:

- **Casca fina**: as tools chamam a **API que já existe** (`/api/free-agents`,
  `/api/equipes`) — nenhuma regra de negócio é reimplementada e nada acessa o
  banco direto.
- **Escopo mínimo**: todas as tools são **somente leitura**
  (`readOnlyHint: true`). Tools de escrita (criar equipe, aceitar candidatura)
  exigiriam sessão autenticada e ficam para uma iteração futura, junto com o
  log de auditoria dessas ações.

### Por que op.gg? (fonte provisória de estatísticas)

O site hoje só *redireciona* o usuário para o League of Graphs — não temos
dados de desempenho porque a **Riot ainda não liberou nossa chave de API**.
Como medida provisória, este servidor atua também como **cliente MCP** do
[servidor MCP público do op.gg](https://op.gg/open-source/opgg-mcp)
(`https://mcp-api.op.gg/mcp`, Streamable HTTP, MIT, **sem chave**): as tools de
estatística fazem proxy das tools `lol_get_summoner_profile` e
`lol_list_summoner_matches` de lá. O nickname `Nome#TAG` dos cadastros é
exatamente o Riot ID que o op.gg espera (região padrão `BR`).

Quando a chave da Riot sair, basta reimplementar `mcp/opgg.ts` mantendo as
mesmas funções exportadas — nada mais muda.

## Tools

| Tool | O que faz | Fonte |
|------|-----------|-------|
| `buscar_free_agents(lane?)` | Jogadores disponíveis (FILL atende qualquer rota) | API local |
| `listar_equipes(lane?, apenas_abertas?)` | Equipes e vagas abertas por rota | API local |
| `perfil_invocador(nickname, regiao?)` | Tier/LP, winrate e campeões mais jogados | op.gg |
| `partidas_recentes(nickname, quantidade?, regiao?)` | Últimas partidas (KDA, campeão, resultado) | op.gg |
| `sugerir_composicao(equipeId? \| vagas, incluir_stats?, max_por_vaga?)` | Rankeia candidatos por vaga + escalação sem repetir jogador; opcionalmente anexa o rank real (op.gg) dos escalados | API local + op.gg |

**Resources** (somente leitura): `teamfinder://free-agents` e `teamfinder://equipes`.
**Prompt**: `montar_time(equipeId?)` — roteiro pronto de "montar time equilibrado".

O ranking de `sugerir_composicao` é lógica pura em [`compose.ts`](compose.ts)
(testada em [`compose.test.ts`](compose.test.ts)): lane principal > secundária >
fill, desempate por ordem de cadastro, e escalação gulosa começando pelas vagas
mais escassas (um jogador versátil não "rouba" a única opção de outra vaga).

## Como rodar

Pré-requisito: o site no ar (`npm run dev`, ou o docker-compose local).

```bash
npm run mcp              # inicia o servidor (stdio)
npm run mcp:inspector    # abre o MCP Inspector (debug visual das tools)
```

> Alternativa sem tsx (Node 23+): `node mcp/server.ts`.

### Variáveis de ambiente

| Variável | Default | Para quê |
|----------|---------|----------|
| `TEAMFINDER_API_URL` | `http://localhost:3000` | URL base da API do site |
| `OPGG_MCP_URL` | `https://mcp-api.op.gg/mcp` | Endpoint do MCP remoto do op.gg |
| `OPGG_REGION` | `BR` | Região padrão das consultas de invocador |

### Plugando no Claude Desktop

`claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "teamfinder": {
      "command": "npx",
      "args": ["tsx", "C:/caminho/para/projeto-eq16/mcp/server.ts"],
      "env": { "TEAMFINDER_API_URL": "http://localhost:3000" }
    }
  }
}
```

### Plugando no Claude Code

```bash
claude mcp add teamfinder -- npx tsx mcp/server.ts
```

## Exemplos de uso (perguntas ao assistente)

- "Quais free agents de MID estão disponíveis?"
- "Liste as equipes com vaga de suporte."
- "Qual o elo e o winrate do jogador `Chico kit lasca#Chico`?"
- "Monte um time equilibrado para a equipe X e justifique cada escolha
  considerando o rank dos jogadores." → o assistente chama
  `sugerir_composicao(equipeId, incluir_stats=true)`.

## Segurança

- Tools **somente leitura**, marcadas com `readOnlyHint` — o servidor não
  consegue alterar nada no sistema.
- Nenhum segredo é necessário: a API usada é pública e o MCP do op.gg não usa
  chave. Logs vão para **stderr** (stdout é o canal do protocolo).
- Escritas futuras (ex.: `notificar_discord`) deverão exigir autenticação e
  registrar no log de auditoria da disciplina, como recomenda o `MCP-IDEIA.md`.
