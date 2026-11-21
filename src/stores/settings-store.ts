import { create } from 'zustand';
import { SettingsData, ToneValue, VoiceValue } from '../types/settings';

export interface SettingsState {
  systemPrompt: string;
  ttsStylePrompt: string;
  settings: SettingsData;
  setSystemPrompt: (prompt: string) => void;
  setVoice: (voice: VoiceValue) => void;
  setTone: (tone: ToneValue) => void;
  updateSettings: (newSettings: Partial<SettingsData> | SettingsData) => void;
}

/**
 * Settings Store - 全局設定 Store (Zustand)
 * 
 * 完全替換舊有的 React SettingsContext。
 * 無需在外部包裹 <SettingsProvider>，可在任何 React 元件或 Hook 中直連取用。
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  systemPrompt: '你是一個樂於助人的 AI 語音助手。請用簡短、自然且流利的方式回答問題。',
  ttsStylePrompt: '用輕鬆隨性的語調說話',
  settings: {
    voice: 'Erinome',
    tone: 'relaxed',
    models: {
      llm: 'gemini-2.5-flash',
      tts: 'gemini-2.5-flash-preview-tts'
    }
  },

  setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
  setVoice: (voice) =>
    set((state) => ({
      settings: { ...state.settings, voice }
    })),
  setTone: (tone) =>
    set((state) => ({
      settings: { ...state.settings, tone }
    })),
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { 
        ...state.settings, 
        ...newSettings,
        models: {
          ...state.settings.models,
          ...(newSettings.models || {})
        }
      }
    }))
}));

/**
 * 向後相容 Hook (代替原本 Context 的 useSettings)
 */
export function useSettings() {
  const store = useSettingsStore();
  return {
    systemPrompt: store.systemPrompt,
    ttsStylePrompt: store.ttsStylePrompt,
    settings: store.settings,
    updateSettings: store.updateSettings,
    setSystemPrompt: store.setSystemPrompt,
    setVoice: store.setVoice,
    setTone: store.setTone
  };
}
