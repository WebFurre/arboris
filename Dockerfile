# Stage 1: Build stage
FROM node:22-alpine AS builder

# Включаем pnpm через corepack
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Кэшируем слой зависимостей
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Копируем исходники и собираем продакшен-бандл
COPY . .
RUN pnpm build

# Stage 2: Runtime stage
FROM nginx:alpine AS runner

# Копируем скомпилированную статику из первого этапа
COPY --from=builder /app/dist /usr/share/nginx/html

# Открываем стандартный HTTP порт
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]