# 即時語音客服 Agent

在國泰人壽 GenAI 實習期間（2025 年 7–12 月）做的瀏覽器版語音客服原型。
同一套 React + TypeScript 介面，可以切換 **Google Gemini Live**、**Azure OpenAI Realtime** 兩種即時語音 API，以及「語音轉文字 → LLM → 文字轉語音」的備用模式。

**試玩：** https://power7414.github.io/realtime-voice-agent/ （離線示範模式，不會呼叫任何 AI 模型）

[English](README.md) | [繁體中文](README_zh.md)

![示範：開新對話、選 OpenAI Realtime、連線，逐字稿逐輪出現](docs/assets/demo.gif)

*離線示範模式的範例通話（預先寫好的對話，以英文呈現；實習時的系統服務的是說中文的客戶）。實習期間的內部業務 prompt、意圖代碼與真實對話都不在本 repo。*

## 功能
- **一個介面、三種對話模式**：Gemini Live、Azure OpenAI Realtime、STT → 對話模型 → TTS，每個聊天室各自選擇。
- **雙向串流音訊**：麥克風收音和播放都在 AudioWorklet 裡處理（`src/audio/`），音量表驅動語音動畫。
- **插話**：模型回報使用者開始說話時，停止排隊中的播放（`src/audio/streamer.ts`、`src/hooks/use-live-api.ts`）。
- **即時逐字稿與多聊天室**：每個聊天室有自己的逐字稿，存在瀏覽器（localStorage，`src/storage/`），可匯出成文字檔。
- **可設定的角色**：system prompt 與語氣在設定面板調整（Zustand store），不用重新編譯。
- **離線示範模式**：沒有 API 金鑰（或設 `REACT_APP_USE_MOCK=true`）時，Azure Realtime 與 STT-TTS 模式改用模擬客戶端（`src/api/mock-*.ts`）播放一段預先寫好的對話，不花任何費用。

## 執行
```bash
npm install
cp .env.example .env      # 可不填，直接跑離線示範
npm start                 # 或 npm run start-https（HTTPS 下麥克風權限比較順）
```
打開 http://localhost:3000，按 **New Chat**、選模式，再按連線按鈕。

> Create React App 會把 `REACT_APP_*` 寫進建置後的 JavaScript。真的金鑰只在本機用，不要把含金鑰的建置版放上公開網址。

## 示範版建置
```bash
npm run build:demo   # GitHub Pages 用的離線示範版：只用模擬客戶端，網址路徑 /realtime-voice-agent
```

## 測試
```bash
npm test          # 8 個測試套件、25 個測試
npm run build
```

## 來源與我做的部分
這個原型以 Google 的 [Live API Web Console](https://github.com/google-gemini/live-api-web-console) 範例（Apache 2.0）為基礎。Gemini Live 客戶端、音訊收音／播放與 AudioWorklet 來自該範例，保留 Google 的版權標頭，清單見 [NOTICE](NOTICE)。

我在上面加的：
- **Azure OpenAI Realtime 串接**，和 Gemini Live 共用同一個介面（`src/api/azure-realtime.ts`、`src/hooks/use-azure-realtime.ts`）。
- **STT → LLM → TTS 備用模式**（`gemini-stt.ts`、`gemini-tts.ts`、`azure-chat.ts`、`processor.ts`、`tts-player.ts`、`use-stt-conversation.ts`）。
- **三種模式共用的控制器**（`use-conversation-controller.ts`、`use-conversation-events.ts`）。
- **多聊天室、逐字稿保存與匯出**（`src/stores/`、`src/storage/`、`use-chat-manager.ts`、側欄與逐字稿面板）。
- **設定、角色與模式選擇介面**、**離線示範模式**（`mock-*.ts`、`demo-script.ts`）以及 25 個單元測試。

實習期間它也接上了內部服務 API 做意圖辨識與分流；那些內部整合不在本 repo。

## 授權
Apache License 2.0，見 [LICENSE](LICENSE) 與 [NOTICE](NOTICE)。
