# Imagem oficial do Node.js Slim (Debian glibc para compatibilidade total com Tailwind v4, Vite e esbuild)
FROM node:20-slim

# Define o diretório de trabalho
WORKDIR /app

# Copia arquivos de pacotes
COPY package*.json ./

# Instala todas as dependências com tolerância a dependências paritárias
RUN npm install --legacy-peer-deps

# Copia todo o código-fonte da aplicação
COPY . .

# Garante o modo de produção e gera o build dos arquivos estáticos React (SPA)
ENV NODE_ENV=production
RUN CI=false npm run build

# Expõe a porta interna da aplicação e API
EXPOSE 5000

# Executa o servidor unificado Node.js + Express
CMD ["node", "server.js"]
