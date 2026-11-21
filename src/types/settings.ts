/**
 * 設定系統的型別定義
 */

// 對話模式定義（從 chat.ts 導入）
export type ConversationMode = 'live-api' | 'stt-tts' | 'azure-realtime';

// 語調選項
export type ToneValue = 'lively' | 'calm' | 'passionate' | 'relaxed' | 'impatient';

// 音色選項
export type VoiceValue = 'Erinome' | 'Despina' | 'Aoede' | 'Laomedeia' | 'Leda' | 'Sulafat' | 'Zephyr' | 'Charon';

// Live API 模型已寫死為 'gemini-live-2.5-flash-preview'
// export type LiveApiModelValue 已移除，使用常數替代
export type LlmModelValue = 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gemini-2.5-pro';
export type TtsModelValue = 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts';

// 設定數據結構
export interface SettingsData {
  tone: ToneValue;
  voice: VoiceValue;
  customGeminiApiKey?: string;
  customAzureApiKey?: string;
  models: {
    llm: LlmModelValue;
    tts: TtsModelValue;
  };
}

// Live API 模型常數
export const LIVE_API_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025' as const;

// 模式配置
export interface ModeConfig {
  name: string;
  description: string;
  color: string;
  icon: string;
}

// 用戶反饋類型
export type FeedbackType = 'success' | 'error' | 'warning' | 'info';

export interface UserFeedback {
  type: FeedbackType;
  message: string;
  duration?: number; // 顯示時長（毫秒）
}