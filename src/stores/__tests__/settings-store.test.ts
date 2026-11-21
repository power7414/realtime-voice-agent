import { useSettingsStore } from '../settings-store';

describe('SettingsStore 全域設定測試', () => {
  it('應該能正確取得與更新系統 Prompt', () => {
    const newPrompt = '你是一個專業的繁體中文語音 AI';
    useSettingsStore.getState().setSystemPrompt(newPrompt);

    expect(useSettingsStore.getState().systemPrompt).toBe(newPrompt);
  });

  it('應該能正確更新聲音與語調設定', () => {
    useSettingsStore.getState().setVoice('Despina');
    useSettingsStore.getState().setTone('lively');

    const settings = useSettingsStore.getState().settings;
    expect(settings.voice).toBe('Despina');
    expect(settings.tone).toBe('lively');
  });
});
