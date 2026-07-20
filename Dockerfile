# Stage 1: Build da aplicação React
FROM node:20-alpine AS build

WORKDIR /app

# Copia dependências e instala
COPY package*.json ./
RUN npm ci --legacy-peer-deps || npm install

# Copia código fonte e gera a build de produção (SPA)
COPY . .
ENV NODE_ENV=production
RUN CI=false npm run build

# Stage 2: Execução unificada com Node.js + Express
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copia dependências e scripts
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps || npm install --only=production

# Copia código backend e bundle do frontend compilado em /app/build
COPY . .
COPY --from=build /app/build ./build

EXPOSE 5000

CMD ["node", "server.js"]
