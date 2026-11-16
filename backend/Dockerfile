FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY types ./types
COPY backend ./backend
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "--experimental-strip-types", "src/index.ts"]
