/**
 * Hook for Azure OpenAI Realtime API integration
 * 提供與 use-live-api.ts 相似的介面，便於統一管理
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AzureOpenAIRealtimeClient, AzureRealtimeConfig } from "../api/azure-realtime";
import { MockAzureRealtimeClient } from "../api/mock-azure-realtime";
import { debugLog } from "../utils/debug-config";
import { useAudioStreamer } from "./use-audio-streamer";

export interface UseAzureRealtimeConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
  systemPrompt?: string;
  voice?: string;
  enabled?: boolean; // 新增：是否啟用音頻處理
  onTranscription?: (transcription: { text: string; isFinal: boolean; role: 'user' | 'assistant' }) => void;
}

export interface UseAzureRealtimeResult {
  client: AzureOpenAIRealtimeClient;
  connected: boolean;
  ready: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
  error: string | null;
  clearError: () => void;
  updateConfig: (config: Partial<UseAzureRealtimeConfig>) => void;
}

// 最佳 VAD 設定常數
const OPTIMAL_VAD_SETTINGS = {
  enabled: true,
  sensitivity: 0.6,      // 預設靈敏度
  silenceDuration: 600   // 更快的中斷回應，適合插話
};

export function useAzureRealtime(config: UseAzureRealtimeConfig): UseAzureRealtimeResult {
  // 使用 ref 保存最新的配置，避免重複綁定事件
  const configRef = useRef(config);
  configRef.current = config;
  
  // 🟢 正宗動態判定：僅在未設定 Key/Endpoint 或環境變數明確指定 USE_MOCK 時才回退 Mock 模式
  const isMockMode =
    process.env.REACT_APP_USE_MOCK === 'true' ||
    !config.apiKey ||
    !config.endpoint ||
    config.apiKey === 'your_azure_openai_api_key_here';

  // 創建 Azure 客戶端
  const client = useMemo(() => {
    if (!config.enabled) {
      debugLog.info('Azure 客戶端未啟用');
      return undefined;
    }

    if (isMockMode) {
      debugLog.info('🤖 [useAzureRealtime] 啟用 Mock Azure Client 離線模式 (0 Token 消耗)');
      return new MockAzureRealtimeClient() as unknown as AzureOpenAIRealtimeClient;
    }

    const azureConfig: AzureRealtimeConfig = {
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      deploymentName: config.deploymentName,
      apiVersion: config.apiVersion,
      systemPrompt: config.systemPrompt,
      vadSettings: OPTIMAL_VAD_SETTINGS
    };

    debugLog.info(`Azure 客戶端已創建 (VAD: ${OPTIMAL_VAD_SETTINGS.enabled ? 'ON' : 'OFF'})`);
    return new AzureOpenAIRealtimeClient(azureConfig);
  }, [config.enabled, config.endpoint, config.apiKey, config.deploymentName, config.apiVersion, config.systemPrompt, isMockMode]); // 移除 enabled 依賴

  // 使用統一的音頻串流器 Hook
  const { audioStreamer: audioStreamerRef, volume, isInitialized: audioInitialized } = useAudioStreamer({
    contextId: 'azure-audio-out',
    workletId: 'azure-vumeter-out',
    enabled: config.enabled,
    displayName: 'Azure'
  });

  // 狀態管理
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 配置更新
  const updateConfig = useCallback((newConfig: Partial<UseAzureRealtimeConfig>) => {
    // 這裡可以實作動態配置更新
    // 目前暫時只記錄，實際更新需要重新建立連線
    console.log('🔄 Azure Realtime 配置更新:', newConfig);
  }, []);
  
  // 錯誤處理
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 音頻處理器已由 useAudioStreamer Hook 管理

  // 設置事件監聽器 - 只在客戶端存在時
  useEffect(() => {
    // 如果客戶端不存在（未啟用），跳過事件監聽器設置
    if (!client) {
      return;
    }
    
    const onOpen = () => {
      console.log('✅ Azure OpenAI Realtime 連線開啟');
      setConnected(true);
      setError(null);
    };
    
    const onSetupComplete = () => {
      console.log('✅ Azure OpenAI Realtime 設置完成');
      setReady(true);
    };
    
    const onClose = () => {
      console.log('🔌 Azure OpenAI Realtime 連線關閉');
      setConnected(false);
      setReady(false);
    };
    
    const onError = (error: ErrorEvent) => {
      console.error('❌ Azure OpenAI Realtime 錯誤:', error.message);
      setError(error.message || 'Azure Realtime API 發生未知錯誤');
    };
    
    const stopAudioStreamer = () => {
      console.log('⏹️ [Azure] 停止音頻播放 - 用戶插話中斷');
      audioStreamerRef?.stop();
    };

    const onSpeechStarted = () => {
      console.log('🎤 [Azure] 檢測到用戶開始說話 - 取消當前回應');
      // 立即停止音頻播放
      audioStreamerRef?.stop();
      // 主動取消當前回應生成
      if (client && typeof client.cancelCurrentResponse === 'function') {
        client.cancelCurrentResponse();
      }
    };

    const onAudioCleared = () => {
      console.log('🔇 [Azure] 音頻緩衝區已清空');
      // 確保音頻流也停止
      audioStreamerRef?.stop();
    };

    const onAudio = (data: ArrayBuffer) => {
      debugLog.audioProcessing('收到音頻事件:', {
        hasAudioStreamer: !!audioStreamerRef,
        isInitialized: audioInitialized,
        arrayBufferSize: data.byteLength
      });

      if (!audioStreamerRef) {
        console.warn('⚠️ [Azure] AudioStreamer 尚未初始化，無法播放音頻');
        return;
      }

      if (!audioInitialized) {
        console.warn('⚠️ [Azure] AudioStreamer 正在初始化中...');
        return;
      }

      audioStreamerRef.addPCM16(new Uint8Array(data));
      debugLog.audioProcessing('已添加音頻數據到串流器');
    };
    
    // 註冊事件監聽器
    client
      .on("open", onOpen)
      .on("setupcomplete", onSetupComplete)
      .on("close", onClose)
      .on("error", onError)
      .on("interrupted", stopAudioStreamer)
      .on("speech_started", onSpeechStarted)
      .on("audio_cleared", onAudioCleared)
      .on("audio", onAudio);
    
    // 清理函數
    return () => {
      client
        .off("open", onOpen)
        .off("setupcomplete", onSetupComplete)
        .off("close", onClose)
        .off("error", onError)
        .off("interrupted", stopAudioStreamer)
        .off("speech_started", onSpeechStarted)
        .off("audio_cleared", onAudioCleared)
        .off("audio", onAudio)
        .disconnect();
    };
  }, [client, audioInitialized, audioStreamerRef]); // 移除 config 依賴，避免重複綁定
  
  // 連線函數
  const connect = useCallback(async () => {
    if (!client) {
      console.warn('⚠️ Azure 客戶端未啟用，無法連線');
      return;
    }
    
    try {
      setError(null);
      console.log('🔄 開始 Azure OpenAI Realtime 連線...');
      
      const success = await client.connect();
      if (!success) {
        // 檢查是否是因為已經連接而返回 false
        if (client.status === 'connected') {
          console.log('✅ Azure 客戶端已經連接，無需重新連接');
        } else {
          throw new Error('Azure OpenAI Realtime API 連線失敗');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '連線失敗';
      setError(errorMessage);
      console.error('❌ Azure Realtime 連線失敗:', errorMessage);
    }
  }, [client]);
  
  // 斷線函數
  const disconnect = useCallback(async () => {
    if (!client) {
      return;
    }
    
    try {
      client.disconnect();
      setConnected(false);
      setReady(false);
      setError(null);
    } catch (err) {
      console.error('❌ Azure Realtime 斷線失敗:', err);
    }
  }, [client]);
  
  // VAD 設定已固定為最佳值，無需動態更新

  return {
    client: client as any, // 類型兼容性，外部會檢查是否為 null
    connected,
    ready,
    connect,
    disconnect,
    volume,
    error,
    clearError,
    updateConfig,
  };
}