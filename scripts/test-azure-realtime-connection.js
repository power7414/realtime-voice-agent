/**
 * Azure Realtime API 真實連線測試腳本
 * 
 * 執行方式：node scripts/test-azure-realtime-connection.js
 */

const fs = require('fs');
const path = require('path');

function getEnvConfig() {
  const envPath = path.join(__dirname, '../.env');
  const config = {
    endpoint: process.env.REACT_APP_AZURE_OPENAI_REALTIME_ENDPOINT || '',
    apiKey: process.env.REACT_APP_AZURE_OPENAI_REALTIME_API_KEY || '',
    deploymentName: process.env.REACT_APP_AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME || 'gpt-4o-realtime-preview',
    apiVersion: process.env.REACT_APP_AZURE_OPENAI_REALTIME_API_VERSION || '2024-10-01-preview'
  };

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const endpointMatch = envContent.match(/REACT_APP_AZURE_OPENAI_REALTIME_ENDPOINT=(.+)/);
    const keyMatch = envContent.match(/REACT_APP_AZURE_OPENAI_REALTIME_API_KEY=(.+)/);
    const deployMatch = envContent.match(/REACT_APP_AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME=(.+)/);

    if (endpointMatch && endpointMatch[1]) config.endpoint = endpointMatch[1].trim().replace(/["']/g, '');
    if (keyMatch && keyMatch[1]) config.apiKey = keyMatch[1].trim().replace(/["']/g, '');
    if (deployMatch && deployMatch[1]) config.deploymentName = deployMatch[1].trim().replace(/["']/g, '');
  }

  return config;
}

const config = getEnvConfig();

console.log('--------------------------------------------------');
console.log('🧪 正在啟動 Azure Realtime API 真實 WebSocket 連線測試...');
console.log('--------------------------------------------------');

if (!config.endpoint || !config.apiKey) {
  console.error('❌ 失敗：未在 .env 檔案中找到有效的 Azure Realtime Endpoint 或 API Key！');
  console.error('💡 請確認 .env 中的 REACT_APP_AZURE_OPENAI_REALTIME_ENDPOINT 與 API_KEY。');
  process.exit(1);
}

console.log(`🌐 檢測到 Endpoint: ${config.endpoint}`);
console.log(`🚀 Deployment: ${config.deploymentName}`);

// 構建 Azure Realtime WebSocket URL
const wsEndpoint = config.endpoint.replace(/^http/, 'ws');
const wsUrl = `${wsEndpoint}/openai/realtime?api-version=${config.apiVersion}&deployment=${config.deploymentName}`;

console.log(`🔗 嘗試連線至: ${wsUrl.substring(0, 60)}...`);

const WebSocket = global.WebSocket || require('ws');

try {
  const ws = new WebSocket(wsUrl, {
    headers: {
      'api-key': config.apiKey
    }
  });

  const timeout = setTimeout(() => {
    console.error('⏰ 連線逾時：Azure 伺服器未在 10 秒內回應。');
    ws.close();
    process.exit(1);
  }, 10000);

  ws.onopen = () => {
    console.log('✅ WebSocket 通訊管道已開啟 (Handshake Open)');
    console.log('📤 發送 session.update 設定封包...');

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: '你是一個樂於助人的語音助手。'
      }
    };

    ws.send(JSON.stringify(sessionUpdate));
  };

  ws.onmessage = (event) => {
    clearTimeout(timeout);
    let data;
    try {
      data = JSON.parse(event.data.toString());
    } catch (e) {
      data = event.data;
    }

    console.log('📩 收到 Azure 伺服器回應事件:', data.type || data);

    if (data.type === 'session.created' || data.type === 'session.updated') {
      console.log('--------------------------------------------------');
      console.log('🎉 測試大成功！Azure Realtime API 握手成功 (Session Updated)！');
      console.log('✅ 您的 Azure Realtime 設定完全有效！');
      console.log('--------------------------------------------------');
      ws.close();
      process.exit(0);
    }
  };

  ws.onerror = (error) => {
    clearTimeout(timeout);
    console.error('❌ Azure WebSocket 錯誤:', error.message || error);
  };
} catch (err) {
  console.error('❌ 連線建立異常:', err);
}
