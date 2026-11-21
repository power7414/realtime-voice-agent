# 多階段建置 Docker 設定
# Stage 1: 建置階段 (Build Environment)
FROM node:20-alpine AS builder

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json (如果存在)
COPY package*.json ./

# 安裝依賴
RUN npm ci

# 複製源碼
COPY . .

# 建置應用程式
RUN npm run build

# Stage 2: 生產階段 (Production Environment)
FROM nginx:alpine AS production

# 安裝 curl 用於健康檢查
RUN apk add --no-cache curl

# 複製自訂 Nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

# 從建置階段複製建置結果
COPY --from=builder /app/build /usr/share/nginx/html


# 暴露端口 (支援 GCP Cloud Run 的動態端口)
EXPOSE 8080

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/ || exit 1

# 啟動 Nginx
CMD ["nginx", "-g", "daemon off;"]