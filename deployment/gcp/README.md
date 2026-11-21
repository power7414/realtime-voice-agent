# ☁️ GCP Cloud Run 部署指南

將多模態 AI 對話平台部署到 Google Cloud Run 的完整指南。

## 🚀 快速部署

### 1. 環境準備

```bash
# 安裝 Google Cloud CLI (如果尚未安裝)
# macOS
brew install google-cloud-sdk

# Ubuntu/Debian
curl https://sdk.cloud.google.com | bash

# Windows
# 下載安裝程式: https://cloud.google.com/sdk/docs/install
```

### 2. 登入和設定

```bash
# 登入 Google Cloud
gcloud auth login

# 設定專案 ID (替換為您的專案 ID)
gcloud config set project YOUR_PROJECT_ID

# 啟用必要的 API 服務
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 3. 一鍵部署

```bash
# 進入 GCP 部署目錄
cd deployment/gcp

# 執行部署腳本
./deploy-to-gcp.sh
```

腳本會自動：
- ✅ 檢查登入狀態
- ✅ 提示輸入 API 金鑰
- ✅ 驗證所有必要參數
- ✅ 建置 Docker 容器
- ✅ 部署到 Cloud Run
- ✅ 顯示應用程式 URL

## 🔑 需要的 API 金鑰

部署時需要準備以下 API 金鑰：

### Google Gemini API
- 🌐 申請地址: https://ai.google.dev/
- 📝 說明: 用於 Gemini Live API 語音對話

### Azure OpenAI 服務
- 🌐 申請地址: https://azure.microsoft.com/en-us/products/ai-services/openai-service
- 📝 需要的資訊:
  - API Key
  - Endpoint URL (例如: https://your-resource.openai.azure.com/)

### Azure 語音服務
- 🌐 申請地址: https://azure.microsoft.com/en-us/services/cognitive-services/speech-services/
- 📝 需要的資訊:
  - Speech Key
  - Region (例如: eastasia)

## 🎯 部署設定

### 預設配置
- **記憶體**: 1Gi
- **CPU**: 1 core
- **區域**: asia-east1 (台灣)
- **端口**: 8080
- **存取權限**: 允許未驗證存取

### 自訂設定
如需修改設定，編輯 `deploy-to-gcp.sh` 中的以下參數：

```bash
gcloud run deploy conversation-platform \
    --memory 2Gi \              # 增加記憶體
    --cpu 2 \                   # 增加 CPU
    --region us-central1 \      # 變更區域
    --max-instances 10          # 設定最大實例數
```

## 🔧 管理指令

### 查看服務狀態
```bash
gcloud run services describe conversation-platform --region=asia-east1
```

### 查看即時日誌
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=conversation-platform" --limit=50 --format=json
```

### 更新服務
```bash
# 重新執行部署腳本即可
./deploy-to-gcp.sh
```

### 刪除服務
```bash
gcloud run services delete conversation-platform --region=asia-east1
```

## 💰 費用估算

### Cloud Run 計費
- **CPU 和記憶體**: 按使用時間計費
- **請求數**: 每月前 200 萬次請求免費
- **網路**: 出站流量計費

### 預估月費用 (輕度使用)
- 🟢 **免費額度內**: $0 - $5
- 🟡 **中度使用**: $5 - $20
- 🔴 **重度使用**: $20+

> 💡 實際費用取決於使用量，建議設定計費警報

## 🐛 常見問題

### 部署失敗

**錯誤**: `Permission denied`
```bash
# 解決方案：檢查權限
gcloud auth list
gcloud config get-value project
```

**錯誤**: `API not enabled`
```bash
# 解決方案：啟用 API
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 應用程式無法訪問

**問題**: 404 或無法載入
- ✅ 檢查 URL 是否正確
- ✅ 等待冷啟動完成 (首次訪問需要 30-60 秒)
- ✅ 查看服務日誌排除錯誤

### 音頻功能不工作

**問題**: 無法使用麥克風或播放音頻
- ✅ 確認使用 HTTPS (Cloud Run 自動提供)
- ✅ 檢查瀏覽器權限設定
- ✅ 確認 API 金鑰正確

## 🔒 安全最佳實踐

### API 金鑰安全
1. **絕不在程式碼中硬編碼金鑰**
2. **定期輪換 API 金鑰**
3. **使用最小權限原則**
4. **監控 API 使用量**

### 存取控制
```bash
# 如需限制存取，移除 --allow-unauthenticated
gcloud run deploy conversation-platform \
    --remove-unauthenticated

# 設定 IAM 政策
gcloud run services add-iam-policy-binding conversation-platform \
    --member="user:your-email@example.com" \
    --role="roles/run.invoker" \
    --region=asia-east1
```

## 📚 相關資源

- [Google Cloud Run 文檔](https://cloud.google.com/run/docs)
- [gcloud CLI 參考](https://cloud.google.com/sdk/gcloud/reference/run)
- [Cloud Run 計費說明](https://cloud.google.com/run/pricing)
- [Docker 部署指南](../docker/README.md)

---

**維護者**: Development Team
**最後更新**: 2025-09-23
**版本**: GCP Deploy v1.0