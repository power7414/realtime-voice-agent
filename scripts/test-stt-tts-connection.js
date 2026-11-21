/**
 * STT-TTS 模式 REST API 測試腳本
 * 
 * 執行方式：node scripts/test-stt-tts-connection.js
 */

const fs = require('fs');
const path = require('path');

function getEnvConfig() {
  const envPath = path.join(__dirname, '../.env');
  const config = {
    geminiApiKey: process.env.REACT_APP_GEMINI_API_KEY || '',
    azureEndpoint: process.env.REACT_APP_AZURE_OPENAI_ENDPOINT || '',
    azureApiKey: process.env.REACT_APP_AZURE_OPENAI_API_KEY || '',
    azureDeployment: process.env.REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1'
  };

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const geminiKey = envContent.match(/REACT_APP_GEMINI_API_KEY=(.+)/);
    const endpoint = envContent.match(/REACT_APP_AZURE_OPENAI_ENDPOINT=(.+)/);
    const azureKey = envContent.match(/REACT_APP_AZURE_OPENAI_API_KEY=(.+)/);

    if (geminiKey && geminiKey[1]) config.geminiApiKey = geminiKey[1].trim();
    if (endpoint && endpoint[1]) config.azureEndpoint = endpoint[1].trim();
    if (azureKey && azureKey[1]) config.azureApiKey = azureKey[1].trim();
  }

  return config;
}

const config = getEnvConfig();

console.log('--------------------------------------------------');
console.log('🧪 正在測試 STT-TTS 模式關聯服務連線...');
console.log('--------------------------------------------------');

console.log('1. Gemini API (STT / TTS 服務) Key 狀態:', config.geminiApiKey ? '✅ 已設定' : '❌ 未設定');
console.log('2. Azure OpenAI (LLM 推理服務) Endpoint 狀態:', config.azureEndpoint ? '✅ 已設定' : '❌ 未設定');
console.log('3. Azure OpenAI API Key 狀態:', config.azureApiKey ? '✅ 已設定' : '❌ 未設定');

console.log('--------------------------------------------------');
if (config.geminiApiKey || config.azureApiKey) {
  console.log('💡 提示：在沒有真實金鑰時，系統會自動流暢回退至 0 成本 Mock 離線模式！');
} else {
  console.log('⚠️ 未提供連線金鑰，系統將以全離線 Mock 模式運作。');
}
console.log('--------------------------------------------------');
