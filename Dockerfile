# Imagem oficial do Node.js Alpine (leveza e mínimo consumo de disco)
FROM node:20-alpine

# Suporte de compatibilidade glibc para o compilador esbuild/vite no Alpine
RUN apk add --no-cache libc6-compat

# Define o diretório de trabalho
WORKDIR /app

# Copia apenas package.json (sem lockfile de host) para resolução nativa Linux
COPY package.json ./

# Instala dependências com tolerância a peer deps
RUN npm install --legacy-peer-deps

# Copia todo o código-fonte da aplicação
COPY . .

# Garante o modo de produção e gera o build dos arquivos estáticos React (SPA)
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN CI=false npm run build

# Expõe a porta interna da aplicação e API
EXPOSE 5000

# Executa o servidor unificado Node.js + Express
CMD ["node", "server.js"]
