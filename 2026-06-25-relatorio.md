# Relatório de Avaliação — EQ16 (DSC)

| | |
|---|---|
| **Data** | 2026-06-25 |
| **Repositório** | https://github.com/des-sist-corp-ufpb/projeto-eq16 |
| **Aplicação** | https://eq16.dsc.rodrigor.com |
| **Período de atividade** | 2026-06-23 → 2026-06-23 |
| **Total de commits** (sem merges) | 1 |
| **Integrantes** | Gabriel Mizael De Sousa Gomes (@gbrlmzl) |

---

## 1. Tecnologias

- Node.js
- Next.js
- React
- Prisma

---

## 2. Análise Funcional

### Endpoints REST

Não detectados automaticamente.

### Entidades / Tabelas (4 encontradas)

- `Candidatura (via migration.sql)`
- `User (via migration.sql)`
- `FreeAgent (via migration.sql)`
- `Equipe (via migration.sql)`

---

## 3. Análise Arquitetural

| Aspecto | Status | Observação |
|---------|--------|-----------|
| Arquitetura em camadas | ❌ | controller=❌  service=❌  repository=❌ |
| Testes automatizados | ❌ | 0 arquivo(s) de teste |
| Migrations versionadas | ❌ | não encontradas |
| Logging | ❌ | não detectado |
| Autenticação / Segurança | ❌ | não detectado |
| DTOs / Separação de dados | ❌ | não detectado |
| Tratamento global de exceções | ❌ | não detectado |
| Documentação de API (OpenAPI) | ❌ | não detectado |
| Variáveis de ambiente | ❌ | não detectado |
| Dockerfile / docker-compose | ✅ | presente |

---

## 4. Contribuição por Usuário

### Resumo

| Usuário | Commits | % commits | Linhas adicionadas | Linhas no código atual | % código atual |
|---------|---------|-----------|-------------------|----------------------|----------------|
| Gabriel Mizael De Sousa Gomes (@gbrlmzl) | 1 | 100% | 15.779 | 5.281 | 100% |

### Contribuição por Camada

| Camada | Total linhas | Gabriel Mizael De Sousa Gomes (@gbrlmzl) |
|--------|-------------|---------|
| Frontend | 2.317 | 100% |
| Migration | 108 | 100% |

---

*Relatório gerado automaticamente em 2026-06-25.*
*Os dados de contribuição são baseados em `git log --numstat` (linhas adicionadas) e `git blame` (linhas no código atual), excluindo commits de merge.*