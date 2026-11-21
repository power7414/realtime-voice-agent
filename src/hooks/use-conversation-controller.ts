import { useCallback, useState, useEffect } from 'react';
import { useLiveAPI } from './use-live-api';
import { useAzureRealtime } from './use-azure-realtime';
import { useSTTConversation } from './use-stt-conversation';
import { useChatManager } from './use-chat-manager';
import { useSettings } from '../stores/settings-store';
import { AudioRecorder } from '../audio/recorder';
import { 
  GEMINI_API_OPTIONS, 
  AZURE_API_OPTIONS, 
  AZURE_OPENAI_LLM_OPTIONS 
} from '../config/api-config';
import { ConversationMode } from '../types/chat';

/**
 * useConversationController Custom Hook
 * 
 * 統一管理三種對話模式 (Gemini Live / Azure Realtime / STT-TTS) 的連線調度與麥克風狀態。
 * 從 App.tsx 抽離，讓 App.tsx 專注在 UI 渲染。
 */
export function useConversationController() {
  const { getActiveChatRoom } = useChatManager();
  const activeConversationRoom = getActiveChatRoom();
  const currentMode: ConversationMode = activeConversationRoom?.conversationType || 'live-api';

  const { settings, systemPrompt } = useSettings();
  const [muted, setMuted] = useState(false);
  const [inputAudioLevel, setInputAudioLevel] = useState<number>(0);
  const [audioRecorder] = useState(() => new AudioRecorder());

  const isLiveMode = currentMode === 'live-api';
  const isAzureMode = currentMode === 'azure-realtime';
  const isSTTMode = currentMode === 'stt-tts';

  // 優先採用使用者在 UI SettingsModal 自訂輸入的 API Key，保護開發者 Bundle 金鑰資安
  const effectiveGeminiApiKey = settings.customGeminiApiKey || GEMINI_API_OPTIONS.apiKey;
  const effectiveAzureApiKey = settings.customAzureApiKey || AZURE_API_OPTIONS.apiKey;

  // 1. Live API Hook (僅在 live-api 模式時啟用)
  const liveAPI = useLiveAPI({
    ...GEMINI_API_OPTIONS,
    apiKey: effectiveGeminiApiKey,
    enabled: isLiveMode
  });

  // 2. Azure Realtime API Hook (僅在 azure-realtime 模式時啟用)
  const azureRealtime = useAzureRealtime({
    ...AZURE_API_OPTIONS,
    apiKey: effectiveAzureApiKey,
    systemPrompt: systemPrompt,
    enabled: isAzureMode
  });

  // 3. STT-TTS Hook (僅在 stt-tts 模式時啟用)
  const sttConversation = useSTTConversation({
    enabled: isSTTMode,
    apiKey: effectiveGeminiApiKey,
    azureConfig: {
      ...AZURE_OPENAI_LLM_OPTIONS,
      apiKey: effectiveAzureApiKey
    },
    settings: settings
  });

  // 統一連線狀態
  const connected = isLiveMode ? liveAPI.connected : isAzureMode ? azureRealtime.connected : false;
  const ready = isLiveMode ? liveAPI.ready : isAzureMode ? azureRealtime.ready : false;

  const isConnected = isSTTMode ? (sttConversation.connected || sttConversation.ready) : connected;
  const isConnecting = isSTTMode ? sttConversation.isProcessingVoice : false;

  // 統一連線處理 (帶有 UI 錯誤解鎖與 Alert 提示)
  const handleConnect = useCallback(async () => {
    if (!activeConversationRoom) return;

    try {
      console.log(`🔌 [Controller] 連接 ${currentMode}`);
      switch (currentMode) {
        case 'live-api':
          await liveAPI.connect();
          break;
        case 'azure-realtime':
          await azureRealtime.connect();
          break;
        case 'stt-tts':
          await sttConversation.connect();
          break;
      }
    } catch (error: any) {
      console.error('❌ [Controller] Connection failed:', error);
      const errorMsg = error?.message || 'Please check your API Key and network connection.';
      alert(`⚠️ Connection Failed\nReason: ${errorMsg}`);
    }
  }, [activeConversationRoom, currentMode, liveAPI, azureRealtime, sttConversation]);

  // 統一斷線處理
  const handleDisconnect = useCallback(async () => {
    if (!activeConversationRoom) return;

    try {
      console.log(`🔌 [Controller] 斷開 ${currentMode}`);
      switch (currentMode) {
        case 'live-api':
          if (audioRecorder) audioRecorder.stop();
          await liveAPI.disconnect();
          break;
        case 'azure-realtime':
          if (audioRecorder) audioRecorder.stop();
          await azureRealtime.disconnect();
          break;
        case 'stt-tts':
          sttConversation.disconnect();
          break;
      }
    } catch (error) {
      console.error('❌ [Controller] 斷線失敗:', error);
    }
  }, [activeConversationRoom, currentMode, liveAPI, azureRealtime, sttConversation, audioRecorder]);

  // 麥克風開關/錄音切換處理
  const handleMicClick = useCallback(async () => {
    if (isSTTMode) {
      try {
        if (sttConversation.isRecording) {
          await sttConversation.stopVoiceRecording();
        } else {
          await sttConversation.startVoiceRecording();
        }
      } catch (error) {
        console.error('❌ [Controller] STT 錄音操作失敗:', error);
      }
    } else {
      setMuted((prev) => !prev);
    }
  }, [isSTTMode, sttConversation]);

  // Realtime 模式音訊串流傳輸處理
  useEffect(() => {
    if (!isLiveMode && !isAzureMode) return;

    const onData = (base64: string) => {
      if (ready && !muted && connected) {
        if (isLiveMode && liveAPI.client) {
          liveAPI.client.sendRealtimeInput([{ mimeType: 'audio/pcm;rate=16000', data: base64 }]);
        } else if (isAzureMode && azureRealtime.client) {
          azureRealtime.client.sendRealtimeInput([{ mimeType: 'audio/pcm;rate=16000', data: base64 }]);
        }
      }
    };

    const onVolume = (vol: number) => setInputAudioLevel(vol);

    if (ready && !muted && audioRecorder && connected) {
      audioRecorder.on('data', onData);
      audioRecorder.on('volume', onVolume);
      audioRecorder.start().catch((err) => console.error('🎤 [Controller] 音頻錄製啟動失敗:', err));
    } else {
      audioRecorder.stop();
      setInputAudioLevel(0);
    }

    return () => {
      audioRecorder.off('data', onData);
      audioRecorder.off('volume', onVolume);
    };
  }, [isLiveMode, isAzureMode, ready, liveAPI.client, azureRealtime.client, muted, audioRecorder, connected]);

  const voiceStatus = isSTTMode
    ? sttConversation.isRecording
      ? 'user_speaking'
      : sttConversation.isSpeaking
      ? 'ai_speaking'
      : sttConversation.isProcessingVoice
      ? 'connecting'
      : sttConversation.ready
      ? 'idle'
      : 'disconnected'
    : isConnecting
    ? 'connecting'
    : !connected
    ? 'disconnected'
    : 'idle';

  return {
    currentMode,
    activeConversationRoom,
    isConnected,
    isConnecting,
    isSTTMode,
    muted,
    voiceStatus,
    inputAudioLevel,
    liveClient: liveAPI.client,
    azureClient: azureRealtime.client,
    sttConversation,
    handleConnect,
    handleDisconnect,
    handleMicClick
  };
}
