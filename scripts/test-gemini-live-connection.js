/**
 * Gemini Live API 真實連線測試腳本
 * 
 * 執行方式：node scripts/test-gemini-live-connection.js
 */

const fs = require('fs');
const path = require('path');

// 1. 讀取 .env 檔案中的 API Key
function getApiKey() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/REACT_APP_GEMINI_API_KEY=(.+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return process.env.REACT_APP_GEMINI_API_KEY || '';
}

const apiKey = getApiKey();

console.log('--------------------------------------------------');
console.log('🧪 正在啟動 Gemini Live API 真實 WebSocket 連線測試...');
console.log('--------------------------------------------------');

if (!apiKey || apiKey === 'your_gemini_api_key_here') {
  console.error('❌ 失敗：未在 .env 檔案中找到有效的 REACT_APP_GEMINI_API_KEY！');
  console.error('💡 請先在專案根目錄的 .env 檔案中填入您的真實 Gemini API Key。');
  process.exit(1);
}

console.log(`🔑 檢測到 API Key: ${apiKey.substring(0, 10)}... (長度: ${apiKey.length})`);

// 2. 構建 Google 官方 Gemini Live WebSocket URL
const host = 'generativelanguage.googleapis.com';
const apiVersion = 'v1alpha';
const wsUrl = `wss://${host}/ws/google.ai.generativelanguage.${apiVersion}.GenerativeService.BidiGenerateContent?key=${apiKey}`;

console.log(`🌐 正在連線至 WebSocket 伺服器: wss://${host}/... (${apiVersion})`);

// 使用 Node.js 18+ 內建的 WebSocket 或通用類
const WebSocket = global.WebSocket || require('ws');

try {
  const ws = new WebSocket(wsUrl);

  const timeout = setTimeout(() => {
    console.error('⏰ 連線逾時：伺服器未在 10 秒內回應。');
    ws.close();
    process.exit(1);
  }, 10000);

  ws.onopen = () => {
    console.log('✅ WebSocket 通訊管道已開啟 (Handshake Open)');
    console.log('📤 發送初始 Setup 設定封包 (models/gemini-2.5-flash-native-audio-preview-09-2025)...');

    const setupPayload = {
      setup: {
        model: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Erinome'
              }
            }
          }
        }
      }
    };

    ws.send(JSON.stringify(setupPayload));
  };

  ws.onmessage = (event) => {
    clearTimeout(timeout);
    let data;
    try {
      data = typeof event.data === 'string' ? JSON.parse(event.data) : JSON.parse(event.data.toString());
    } catch (e) {
      data = event.data;
    }

    console.log('📩 收到 Google 伺服器回應數據:', JSON.stringify(data, null, 2));

    if (data.setupComplete) {
      console.log('--------------------------------------------------');
      console.log('🎉 測試大成功！Gemini Live API 握手成功 (SetupComplete)！');
      console.log('✅ 您的 API Key 完全有效，可以隨時切換至真實 API 進行即時語音對話！');
      console.log('--------------------------------------------------');
      ws.close();
      process.exit(0);
    }
  };

  ws.onerror = (error) => {
    clearTimeout(timeout);
    console.error('❌ WebSocket 錯誤:', error.message || error);
  };

  ws.onclose = (event) => {
    clearTimeout(timeout);
    if (event.code !== 1000) {
      console.log(`🔌 連線關閉，代碼: ${event.code}, 原因: ${event.reason || '未知'}`);
    }
  };
} catch (err) {
  console.error('❌ 連線建立異常:', err);
}
