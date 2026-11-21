#!/bin/bash

# 🚀 GCP Cloud Run 部署腳本
# 多模態 AI 對話平台部署到 Google Cloud Run

echo "🚀 開始部署多模態 AI 對話平台到 GCP Cloud Run"
echo "=================================================="
echo ""

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

# 提示用戶輸入 API 金鑰
echo "🔑 請輸入 API 金鑰："
echo "（輸入過程中不會顯示字元，這是正常的安全機制）"
echo ""

read -s -p "🟢 Gemini API Key: " GEMINI_KEY
echo ""

echo ""
echo "🔵 Azure OpenAI 設定："
read -s -p "  API Key: " AZURE_KEY
echo ""
read -p "  Endpoint: " AZURE_ENDPOINT
read -p "  Deployment Name (例如: gpt-4): " AZURE_DEPLOYMENT
read -p "  API Version (例如: 2025-01-01-preview): " AZURE_API_VERSION

echo ""
echo "🎙️ Azure OpenAI Realtime API 設定："
read -p "  Realtime Endpoint: " AZURE_REALTIME_ENDPOINT
read -s -p "  Realtime API Key: " AZURE_REALTIME_KEY
echo ""
read -p "  Realtime Deployment Name (例如: gpt-realtime): " AZURE_REALTIME_DEPLOYMENT
read -p "  Realtime API Version (例如: 2024-10-01-preview): " AZURE_REALTIME_API_VERSION
read -p "  Realtime Model (例如: gpt-realtime): " AZURE_REALTIME_MODEL
read -p "  Realtime Version (例如: 2025-08-28): " AZURE_REALTIME_VERSION

echo ""
echo "🎤 Azure Speech 設定："
read -s -p "  Speech Key (可選，按 Enter 略過): " SPEECH_KEY
echo ""
read -p "  Speech Region (例如: eastasia，可選): " SPEECH_REGION

# 設定預設值
SPEECH_KEY="${SPEECH_KEY:-dummy_speech_key}"
SPEECH_REGION="${SPEECH_REGION:-eastasia}"
AZURE_API_VERSION="${AZURE_API_VERSION:-2025-01-01-preview}"
AZURE_REALTIME_API_VERSION="${AZURE_REALTIME_API_VERSION:-2024-10-01-preview}"
AZURE_REALTIME_MODEL="${AZURE_REALTIME_MODEL:-gpt-realtime}"
AZURE_REALTIME_VERSION="${AZURE_REALTIME_VERSION:-2025-08-28}"

echo ""
echo "🔍 驗證輸入..."

# 檢查必要參數
if [[ -z "$GEMINI_KEY" || -z "$AZURE_KEY" || -z "$AZURE_ENDPOINT" || -z "$AZURE_REALTIME_ENDPOINT" || -z "$AZURE_REALTIME_KEY" ]]; then
    echo "❌ 錯誤：必要的 API 金鑰和端點都需要填寫"
    echo "   - Gemini API Key"
    echo "   - Azure OpenAI Key"
    echo "   - Azure OpenAI Endpoint"
    echo "   - Azure Realtime Endpoint"
    echo "   - Azure Realtime API Key"
    exit 1
fi

echo "✅ 輸入驗證通過"
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

read -p "是否繼續部署？ (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "❌ 部署已取消"
    exit 0
fi

echo ""
echo "🏗️ 開始建置和部署..."

# 執行部署
gcloud run deploy conversation-platform \
    --source ../../ \
    --platform managed \
    --region asia-east1 \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --port 8080 \
    --set-env-vars NODE_ENV=production \
    --set-env-vars REACT_APP_GEMINI_API_KEY="$GEMINI_KEY" \
    --set-env-vars REACT_APP_AZURE_OPENAI_KEY="$AZURE_KEY" \
    --set-env-vars REACT_APP_AZURE_OPENAI_ENDPOINT="$AZURE_ENDPOINT" \
    --set-env-vars REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME="$AZURE_DEPLOYMENT" \
    --set-env-vars REACT_APP_AZURE_OPENAI_API_VERSION="$AZURE_API_VERSION" \
    --set-env-vars REACT_APP_AZURE_OPENAI_REALTIME_ENDPOINT="$AZURE_REALTIME_ENDPOINT" \
    --set-env-vars REACT_APP_AZURE_OPENAI_REALTIME_API_KEY="$AZURE_REALTIME_KEY" \
    --set-env-vars REACT_APP_AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME="$AZURE_REALTIME_DEPLOYMENT" \
    --set-env-vars REACT_APP_AZURE_OPENAI_REALTIME_API_VERSION="$AZURE_REALTIME_API_VERSION" \
    --set-env-vars REACT_APP_AZURE_OPENAI_REALTIME_MODEL="$AZURE_REALTIME_MODEL" \
    --set-env-vars REACT_APP_AZURE_OPENAI_REALTIME_VERSION="$AZURE_REALTIME_VERSION" \
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