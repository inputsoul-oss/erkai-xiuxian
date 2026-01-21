# 构建阶段
FROM node:lts AS build 
WORKDIR /app
COPY . .
ARG VITE_ZHIPU_API_KEY
ARG VITE_ZHIPU_BASE_URL
ARG VITE_ZHIPU_MODEL
ENV VITE_ZHIPU_API_KEY=$VITE_ZHIPU_API_KEY
ENV VITE_ZHIPU_BASE_URL=$VITE_ZHIPU_BASE_URL
ENV VITE_ZHIPU_MODEL=$VITE_ZHIPU_MODEL
RUN npm install && \
  npm run build

# 运行阶段
FROM node:lts AS runtime 
WORKDIR /app
COPY --from=build /app/dist /app
RUN npm install -g http-server

EXPOSE 8080

CMD ["http-server", "/app", "-p", "8080"]
