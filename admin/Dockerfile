FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY types ./types
COPY admin ./admin
WORKDIR /app/admin
RUN npm install
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/admin/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
