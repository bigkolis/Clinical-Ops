FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY api ./api
COPY lib ./lib
COPY src/clinical.js ./src/clinical.js
COPY server.mjs ./server.mjs
EXPOSE 3000
CMD ["node","server.mjs"]
