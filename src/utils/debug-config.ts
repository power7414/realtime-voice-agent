/**
 * Debug 配置管理 - 簡化版
 * 只在開發環境啟用，移除不必要的動態切換功能
 */

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Debug 日誌輔助函數
 * 開發環境自動啟用，生產環境自動關閉
 */
export const debugLog = {
  azureRealtime: (message: string, ...args: any[]) => {
    if (IS_DEV) console.log(`🔍 [Azure Debug] ${message}`, ...args);
  },

  audioProcessing: (message: string, ...args: any[]) => {
    if (IS_DEV) console.log(`🔊 [Audio Debug] ${message}`, ...args);
  },

  transcription: (message: string, ...args: any[]) => {
    if (IS_DEV) console.log(`📝 [Transcription Debug] ${message}`, ...args);
  },

  info: (message: string, ...args: any[]) => {
    console.log(`ℹ️  ${message}`, ...args);
  },

  error: (message: string, ...args: any[]) => {
    console.error(`❌ ${message}`, ...args);
  },

  success: (message: string, ...args: any[]) => {
    console.log(`✅ ${message}`, ...args);
  }
};
