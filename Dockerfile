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
RUN npm run build -w shared && npm run build -w server

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json .npmrc ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY client/package.json ./client/
RUN npm install --omit=dev \
  && rm -rf server/node_modules client/node_modules shared/node_modules
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/server/dist ./server/dist
RUN node -e "const fs=require('fs');const p='shared/package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.exports={'.':{types:'./dist/index.d.ts',import:'./dist/index.js',default:'./dist/index.js'}};j.main='./dist/index.js';j.types='./dist/index.d.ts';fs.writeFileSync(p,JSON.stringify(j,null,2));"
EXPOSE 3001
ENV PORT=3001
CMD ["node", "server/dist/index.js"]
