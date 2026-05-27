# =============================================================================
# Dockerfile de PRODUÇÃO — Next.js (Node.js) Multi-stage build
# =============================================================================
# Usa imagens baseadas em Alpine para garantir tamanho reduzido e segurança.
# Utiliza a funcionalidade de "standalone" do Next.js para copiar apenas o
# necessário para a execução, sem carregar ferramentas de build ou fontes.

# ---- Estágio 1: Dependências ------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Estágio 2: Build -------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Desabilitar telemetria durante o build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Estágio 3: Runtime -----------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Criar usuário não-root por segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar os arquivos públicos e de assets estáticos
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# Copiar o build "standalone" que contém apenas o que é necessário para rodar
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

USER nextjs

EXPOSE 3000

# Next.js via standalone output gera um server.js na raiz
CMD ["node", "server.js"]
