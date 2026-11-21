# 🐳 Docker 部署指南

多模態 AI 對話平台的 Docker 容器化部署指南。

## 🎯 平台特色

### 支援的 AI 服務
- **Gemini Live API** - Google 即時語音對話
- **Azure OpenAI Realtime API** - 企業級即時語音
- **STT + LLM + TTS** - 傳統語音轉文字流程

### 核心功能
- 🎤 **即時語音對話** - 低延遲音頻串流
- 💬 **多聊天室管理** - 支援多個對話情境
- 🔄 **統一 API 介面** - 三種模式無縫切換
- 📱 **響應式設計** - 支援桌面和行動裝置
- 🔒 **安全存儲** - API 金鑰本地加密存儲

## 📋 快速開始

### 1. 環境準備

```bash
# 複製環境變數範例檔案
cp .env.example .env

# 編輯 .env 檔案，填入你的 API 金鑰
nano .env
```

### 2. 本地運行 (生產模式)

```bash
# 進入 Docker 部署目錄
cd deployment/docker

# 建置並啟動容器
docker-compose up --build

# 在背景運行
docker-compose up -d

# 訪問應用程式
open http://localhost:3000
```

### 3. 開發模式 (可選)

```bash
# 進入 Docker 部署目錄
cd deployment/docker

# 啟動開發模式容器 (熱重載)
docker-compose --profile dev up conversation-platform-dev

# 訪問開發版本
open http://localhost:3001
```

## 🏗️ 架構說明

### 多階段建置

```
Stage 1 (Builder): Node.js 20 Alpine
├── 安裝依賴 (npm ci)
├── 複製源碼
└── 建置應用 (npm run build)

Stage 2 (Production): Nginx Alpine
├── 複製建置結果
├── 自訂 Nginx 配置 (nginx.conf)
├── 動態 prompt.txt 掛載
└── 健康檢查設定
```

### 特殊配置

- **動態 Port 支援**: 支援 GCP Cloud Run 的 `$PORT` 環境變數
- **SPA 路由**: Nginx 配置支援 React Router
- **Prompt 動態更新**: `prompt.txt` 不緩存，支援即時更新
- **健康檢查**: `/health` 端點用於容器監控

## 🌍 GCP Cloud Run 部署

### 準備工作

```bash
# 安裝 Google Cloud CLI
# macOS: brew install google-cloud-sdk
# Ubuntu: apt-get install google-cloud-cli

# 登入並設定專案
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 啟用必要服務
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 建置和部署

```bash
# 方法 1: 使用 Cloud Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/conversation-platform

gcloud run deploy conversation-platform \
  --image gcr.io/YOUR_PROJECT_ID/conversation-platform \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --port 8080 \
  --set-env-vars NODE_ENV=production

# 方法 2: 直接部署 (推薦)
gcloud run deploy conversation-platform \
  --source . \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1
```

### 環境變數設定

```bash
# 使用 Secret Manager (推薦)
echo -n "your_gemini_api_key" | gcloud secrets create gemini-api-key --data-file=-
echo -n "your_azure_openai_key" | gcloud secrets create azure-openai-key --data-file=-
echo -n "your_azure_speech_key" | gcloud secrets create azure-speech-key --data-file=-

gcloud run deploy conversation-platform \
  --set-secrets REACT_APP_GEMINI_API_KEY=gemini-api-key:latest \
  --set-secrets REACT_APP_AZURE_OPENAI_KEY=azure-openai-key:latest \
  --set-secrets REACT_APP_AZURE_SPEECH_KEY=azure-speech-key:latest \
  --set-env-vars REACT_APP_AZURE_OPENAI_ENDPOINT=your_endpoint_here \
  --set-env-vars REACT_APP_AZURE_SPEECH_REGION=your_region_here

# 或直接設定環境變數 (不推薦用於生產環境)
gcloud run deploy conversation-platform \
  --set-env-vars REACT_APP_GEMINI_API_KEY=your_gemini_key \
  --set-env-vars REACT_APP_AZURE_OPENAI_KEY=your_azure_key \
  --set-env-vars REACT_APP_AZURE_OPENAI_ENDPOINT=your_endpoint \
  --set-env-vars REACT_APP_AZURE_SPEECH_KEY=your_speech_key \
  --set-env-vars REACT_APP_AZURE_SPEECH_REGION=your_region
```

## 🔧 常用命令

### 開發工具

```bash
# 查看容器日誌
docker-compose logs -f

# 進入容器 shell
docker-compose exec conversation-platform sh

# 重新建置
docker-compose build --no-cache

# 清理容器和映像
docker-compose down
docker system prune -f
```

### 本地測試

```bash
# 進入專案根目錄
cd ../..

# 測試 Docker 建置
docker build -f deployment/docker/Dockerfile -t conversation-platform .

# 測試容器運行
docker run -p 3000:8080 \
  -e REACT_APP_GEMINI_API_KEY=your_key \
  conversation-platform

# 健康檢查測試
curl http://localhost:3000/health
```

## 📊 監控和除錯

### 健康檢查

- **端點**: `GET /health`
- **回應**: `200 "healthy"`
- **用途**: Docker 和 Cloud Run 健康檢查

### 日誌監控

```bash
# 本地日誌
docker-compose logs -f conversation-platform

# Cloud Run 日誌
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=conversation-platform" --limit 50 --format json
```

### 效能監控

```bash
# 容器資源使用
docker stats

# Cloud Run 指標
gcloud run services describe conversation-platform --region=asia-east1
```

## 🔒 安全最佳實踐

### API 金鑰管理

1. **絕不在 Dockerfile 中包含機密資訊**
2. **使用 .env 檔案進行本地開發**
3. **生產環境使用 Secret Manager**
4. **定期輪換 API 金鑰**

### 網路安全

```nginx
# 已包含的安全標頭
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'self' ...
```

## 🚀 部署檢查清單

### 部署前檢查

- [ ] 填寫所有必要的環境變數
- [ ] 測試本地 Docker 建置
- [ ] 確認 API 金鑰有效
- [ ] 檢查 `prompt.txt` 內容

### 部署後驗證

- [ ] 健康檢查端點回應正常
- [ ] 應用程式可正常訪問
- [ ] 音頻功能運作正常 (需要 HTTPS)
- [ ] WebSocket 連線穩定

## 🐛 常見問題

### 建置失敗

```bash
# 清理 Docker 快取
docker builder prune -f

# 檢查 .dockerignore 是否排除了必要檔案
cat .dockerignore
```

### 環境變數不生效

```bash
# 確認變數名稱有 REACT_APP_ 前綴
# React 只會包含以 REACT_APP_ 開頭的環境變數
```

### Cloud Run 部署失敗

```bash
# 檢查權限
gcloud auth list
gcloud config get-value project

# 檢查服務限制
gcloud run services describe conversation-platform --region=asia-east1
```

## 📚 相關資源

- [Docker 官方文檔](https://docs.docker.com/)
- [Google Cloud Run 文檔](https://cloud.google.com/run/docs)
- [Nginx 配置指南](https://nginx.org/en/docs/)
- [React 環境變數指南](https://create-react-app.dev/docs/adding-custom-environment-variables/)

---

**維護者**: Development Team
**最後更新**: 2025-09-23
**版本**: Docker Setup v1.1