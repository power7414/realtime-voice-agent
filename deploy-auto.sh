#!/bin/bash

# 🚀 自動化 GCP Cloud Run 部署腳本
# 從 .env 檔案讀取設定並部署

echo "🚀 開始部署多模態 AI 對話平台到 GCP Cloud Run"
echo "=================================================="
echo ""

# 載入 .env 檔案
if [ ! -f .env ]; then
    echo "❌ 找不到 .env 檔案"
    exit 1
fi

# 讀取 .env 檔案中的變數
export $(cat .env | grep -v '^#' | xargs)

# 檢查是否已登入 gcloud
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ 請先登入 Google Cloud:"
    echo "   gcloud auth login"
    exit 1
fi

# 顯示當前專案
PROJECT_ID=$(gcloud config get-value project)
echo "📋 當前 Google Cloud 專案: $PROJECT_ID"
echo ""

# 設定變數（從 .env 讀取）
GEMINI_KEY="${REACT_APP_GEMINI_API_KEY}"
AZURE_KEY="${REACT_APP_AZURE_OPENAI_API_KEY}"
AZURE_ENDPOINT="${REACT_APP_AZURE_OPENAI_ENDPOINT}"

# Azure Speech 服務需要的設定（使用預設值）
SPEECH_KEY="${REACT_APP_AZURE_SPEECH_KEY:-dummy_speech_key}"
SPEECH_REGION="${REACT_APP_AZURE_SPEECH_REGION:-eastasia}"

echo "🔍 驗證設定..."

# 檢查必要參數
if [[ -z "$GEMINI_KEY" || -z "$AZURE_KEY" || -z "$AZURE_ENDPOINT" ]]; then
    echo "❌ 錯誤：請確認 .env 檔案中的 API 金鑰設定"
    exit 1
fi

echo "✅ 設定驗證通過"
echo ""

# 顯示部署設定
echo "🎯 部署設定："
echo "   - 專案: $PROJECT_ID"
echo "   - 服務名稱: conversation-platform"
echo "   - 區域: asia-east1"
echo "   - 記憶體: 1Gi"
echo "   - CPU: 1 core"
echo "   - 端口: 8080"
echo ""

echo "🏗️ 開始建置和部署..."

# 執行部署（使用 Dockerfile）
echo "🏗️ 使用 Dockerfile 建置和部署..."
gcloud run deploy conversation-platform \
    --source . \
    --platform managed \
    --region asia-east1 \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --port 8080 \
    --clear-base-image \
    --set-env-vars NODE_ENV=production \
    --set-env-vars REACT_APP_GEMINI_API_KEY="$GEMINI_KEY" \
    --set-env-vars REACT_APP_AZURE_OPENAI_KEY="$AZURE_KEY" \
    --set-env-vars REACT_APP_AZURE_OPENAI_ENDPOINT="$AZURE_ENDPOINT" \
    --set-env-vars REACT_APP_AZURE_OPENAI_REALTIME_ENDPOINT="${REACT_APP_AZURE_OPENAI_REALTIME_ENDPOINT}" \
    --set-env-vars REACT_APP_AZURE_OPENAI_REALTIME_API_KEY="${REACT_APP_AZURE_OPENAI_REALTIME_API_KEY}" \
    --set-env-vars REACT_APP_AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME="${REACT_APP_AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME}" \
    --set-env-vars REACT_APP_AZURE_OPENAI_REALTIME_API_VERSION="${REACT_APP_AZURE_OPENAI_REALTIME_API_VERSION}" \
    --set-env-vars REACT_APP_AZURE_OPENAI_REALTIME_MODEL="${REACT_APP_AZURE_OPENAI_REALTIME_MODEL}" \
    --set-env-vars REACT_APP_AZURE_OPENAI_REALTIME_VERSION="${REACT_APP_AZURE_OPENAI_REALTIME_VERSION}" \
    --set-env-vars REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME="${REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME}" \
    --set-env-vars REACT_APP_AZURE_OPENAI_API_VERSION="${REACT_APP_AZURE_OPENAI_API_VERSION}" \
    --set-env-vars REACT_APP_AZURE_SPEECH_KEY="$SPEECH_KEY" \
    --set-env-vars REACT_APP_AZURE_SPEECH_REGION="$SPEECH_REGION"

# 檢查部署結果
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 部署完成！"
    echo ""

    # 獲取服務 URL
    SERVICE_URL=$(gcloud run services describe conversation-platform --platform=managed --region=asia-east1 --format='value(status.url)')

    echo "📱 您的應用程式已部署至："
    echo "   $SERVICE_URL"
    echo ""
    echo "🔧 管理您的服務："
    echo "   查看狀態: gcloud run services describe conversation-platform --region=asia-east1"
    echo "   查看日誌: gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=conversation-platform' --limit=50"
    echo "   刪除服務: gcloud run services delete conversation-platform --region=asia-east1"
    echo ""
    echo "💡 提示："
    echo "   - 音頻功能需要 HTTPS 才能正常運作"
    echo "   - 首次訪問可能需要等待容器啟動（冷啟動）"
    echo "   - 如需更新，再次執行此腳本即可"

else
    echo ""
    echo "❌ 部署失敗！"
    echo "請檢查錯誤訊息並重試"
    exit 1
fi