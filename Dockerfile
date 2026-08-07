# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY client/package.json ./client/
RUN npm install
COPY shared ./shared
COPY server ./server
RUN npm run build -w shared && npm run build -w server \
  && npm prune --omit=dev \
  && rm -rf client \
  && node -e "const fs=require('fs');const p='shared/package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.exports={'.':{types:'./dist/index.d.ts',import:'./dist/index.js',default:'./dist/index.js'}};j.main='./dist/index.js';j.types='./dist/index.d.ts';fs.writeFileSync(p,JSON.stringify(j,null,2));" \
  && node -e "require('fs').accessSync(require('fs').existsSync('node_modules/express')?'node_modules/express':'server/node_modules/express')"

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3001
ENV PORT=3001
CMD ["node", "server/dist/index.js"]
