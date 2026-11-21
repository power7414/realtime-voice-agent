/**
 * API 配置檔
 * 從 App.tsx 抽離，集中管理所有 API 連線參數與環境變數設定
 */

export const GEMINI_API_OPTIONS = {
  apiKey: process.env.REACT_APP_GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: 'v1alpha' // 啟用 affective dialogue 功能需要 v1alpha
  }
};

export const AZURE_API_OPTIONS = {
  endpoint: process.env.REACT_APP_AZURE_OPENAI_REALTIME_ENDPOINT || '',
  apiKey: process.env.REACT_APP_AZURE_OPENAI_REALTIME_API_KEY || '',
  deploymentName: process.env.REACT_APP_AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME || '',
  apiVersion: process.env.REACT_APP_AZURE_OPENAI_REALTIME_API_VERSION || '2024-10-01-preview',
};

export const AZURE_OPENAI_LLM_OPTIONS = {
  endpoint: process.env.REACT_APP_AZURE_OPENAI_ENDPOINT || '',
  apiKey: process.env.REACT_APP_AZURE_OPENAI_API_KEY || '',
  deploymentName: process.env.REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME || '',
  apiVersion: process.env.REACT_APP_AZURE_OPENAI_API_VERSION || '2025-01-01-preview',
};

/**
 * 於除錯階段印出金鑰設置狀態
 */
export function logApiConfigStatus(): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔑 API Configuration Status:', {
      gemini: {
        hasApiKey: !!GEMINI_API_OPTIONS.apiKey,
        apiKeyLength: GEMINI_API_OPTIONS.apiKey.length,
        apiKeyPrefix: GEMINI_API_OPTIONS.apiKey.substring(0, 10) + '...',
        apiVersion: GEMINI_API_OPTIONS.httpOptions?.apiVersion || 'default'
      },
      azureRealtime: {
        hasEndpoint: !!AZURE_API_OPTIONS.endpoint,
        hasApiKey: !!AZURE_API_OPTIONS.apiKey,
        deployment: AZURE_API_OPTIONS.deploymentName,
        apiVersion: AZURE_API_OPTIONS.apiVersion
      },
      azureOpenAI_LLM: {
        hasEndpoint: !!AZURE_OPENAI_LLM_OPTIONS.endpoint,
        hasApiKey: !!AZURE_OPENAI_LLM_OPTIONS.apiKey,
        deployment: AZURE_OPENAI_LLM_OPTIONS.deploymentName,
        apiVersion: AZURE_OPENAI_LLM_OPTIONS.apiVersion
      }
    });
  }
}
