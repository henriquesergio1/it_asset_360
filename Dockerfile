# Imagem oficial do Node.js Alpine (leveza e mínimo consumo de disco)
FROM node:20-alpine

# Define o diretório de trabalho
WORKDIR /app

# Copia arquivos de pacotes
COPY package*.json ./

# Instala dependências com tolerância a peer deps e limpa o cache imediatamente para liberar disco
RUN npm install --legacy-peer-deps --no-audit --no-fund && npm cache clean --force

# Copia todo o código-fonte da aplicação
COPY . .

# Garante o modo de produção e gera o build dos arquivos estáticos React (SPA)
ENV NODE_ENV=production
RUN CI=false npm run build

# Expõe a porta interna da aplicação e API
EXPOSE 5000

# Executa o servidor unificado Node.js + Express
CMD ["node", "server.js"]
