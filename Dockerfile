FROM node:22-slim

# Prisma cần OpenSSL để nạp engine
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
# Railway truyền PORT; main.ts đọc process.env.PORT
EXPOSE 3000
CMD ["node", "dist/main"]
