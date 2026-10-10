FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
# Railway truyền PORT; main.ts đọc process.env.PORT
EXPOSE 3000
CMD ["node", "dist/main"]
