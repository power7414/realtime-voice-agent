/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GenAILiveClient } from "../api/gemini-live";
import { MockGenAILiveClient } from "../api/mock-gemini-live";
import { LiveClientOptions } from "../types";
import { LiveConnectConfig, Modality } from "@google/genai";
import { useSettings } from "../stores/settings-store";
import { LIVE_API_MODEL } from "../types/settings";
import { useAudioStreamer } from "./use-audio-streamer";

export type UseLiveAPIResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig | null) => void;
  config: LiveConnectConfig | null;
  model: string;
  setModel: (model: string) => void;
  connected: boolean;
  ready: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
  updateLiveConfiguration: () => Promise<void>;
  onTranscription?: (transcription: { text: string; isFinal: boolean; role: 'user' | 'assistant' }) => void;
};

export function useLiveAPI(options: LiveClientOptions & {
  enabled?: boolean;
  useMock?: boolean;
  onTranscription?: (transcription: { text: string; isFinal: boolean; role: 'user' | 'assistant' }) => void;
}): UseLiveAPIResults {
  // 分離 enabled 參數，避免觸發 client 重新創建
  const { enabled, useMock, onTranscription, ...clientOptions } = options;
  const isEnabled = enabled ?? true; // 預設啟用

  // 使用 ref 保存最新的配置，避免重複綁定事件
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const client = useMemo(() => {
    if (!isEnabled) {
      return undefined as unknown as GenAILiveClient;
    }

    // 🟢 正宗動態判定：僅當未設定有效 API Key 或環境變數指定 USE_MOCK 時才使用 Mock API
    const isMockMode =
      process.env.REACT_APP_USE_MOCK === 'true' ||
      !clientOptions.apiKey ||
      clientOptions.apiKey === 'your_gemini_api_key_here';

    if (isMockMode) {
      console.log('🤖 [useLiveAPI] 無有效 Key，自動回退至 Mock API 測試模式 (0 Token 消耗)');
      return new MockGenAILiveClient() as unknown as GenAILiveClient;
    }
    console.log('🌐 [useLiveAPI] 檢測到有效 Key，啟動真實 Google GenAILiveClient 伺服器連線');
    const newClient = new GenAILiveClient(clientOptions);
    return newClient;
  }, [clientOptions, isEnabled]); // 只監聽關鍵配置

  // 使用統一的音頻串流器 Hook
  const { audioStreamer: audioStreamerInstance, volume, isInitialized: audioInitialized } = useAudioStreamer({
    contextId: 'gemini-audio-out',
    workletId: 'gemini-vumeter-out',
    enabled: isEnabled,
    displayName: 'Gemini'
  });

  // 使用 ref 保存最新的 streamer 實例，解決 useEffect 閉包導致的 stale closure 問題
  const activeStreamerRef = useRef(audioStreamerInstance);
  useEffect(() => {
    activeStreamerRef.current = audioStreamerInstance;
  }, [audioStreamerInstance]);

  // Get dynamic system prompt, voice settings and TTS style prompt from settings
  const { systemPrompt, settings, ttsStylePrompt } = useSettings();

  // Live API 模型已寫死
  const [model, setModel] = useState<string>(LIVE_API_MODEL);

  // 模型已固定，不需要動態更新
  // useEffect(() => {
  //   setModel(settings.models.liveApi);
  // }, [settings.models.liveApi]);

  // 根據前端設定動態生成語音配置
  const getSpeechConfig = useCallback(() => {
    const config = {
      // Native Audio Dialog 模型會自動選擇語言，不需要 languageCode
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: settings.voice // 使用前端選擇的音色
        }
      }
    };

    // 除錯：確認語音配置
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎵 Live API Speech Config - Voice: ${settings.voice} (Native Audio Dialog)`);
    }

    return config;
  }, [settings.voice]);

  // 延遲配置初始化，只在連接時才生成配置
  const [config, setConfig] = useState<LiveConnectConfig | null>(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);

  // Generate enhanced system instruction with voice style
  const getEnhancedSystemInstruction = useCallback(() => {
    // 將語音風格整合到系統提示中（Live API 主要透過文字指導控制語音）
    const voiceGuidance = ttsStylePrompt
      ? `重要：在語音回應時，請${ttsStylePrompt}。`
      : '';

    const enhancedPrompt = voiceGuidance
      ? `${voiceGuidance}\n\n${systemPrompt}`
      : systemPrompt;

    // 除錯：確認語調設定整合
    if (process.env.NODE_ENV === 'development' && voiceGuidance) {
      console.log(`🎭 Live API Enhanced System Instruction - Tone: ${settings.tone}, Style: ${ttsStylePrompt}`);
    }

    return enhancedPrompt;
  }, [systemPrompt, ttsStylePrompt, settings.tone]);

  // 生成完整配置的函數
  const createConfig = useCallback((): LiveConnectConfig => {
    const config = {
      responseModalities: [Modality.AUDIO],
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      speechConfig: getSpeechConfig(),
      enableAffectiveDialog: true, // 啟用情緒感知對話
      systemInstruction: {
        parts: [{
          text: getEnhancedSystemInstruction()
        }]
      },
      // VAD 設定 - 語音活動檢測 (已註解，使用預設值)
      // realtimeInputConfig: {
      //   automaticActivityDetection: {
      //     disabled: false,
      //     startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
      //     endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
      //     prefixPaddingMs: 100,
      //     silenceDurationMs: 600
      //   }
      // }
    };

    // 除錯日誌
    if (process.env.NODE_ENV === 'development') {
      console.log('🎭 Gemini Live API Config:', {
        enableAffectiveDialog: true,
        voice: settings.voice,
        tone: settings.tone
      });
      // VAD 除錯日誌已註解（使用預設值）
      // console.log('🎤 VAD Config:', {
      //   startSensitivity: 'LOW',
      //   endSensitivity: 'LOW',
      //   prefixPaddingMs: 100,
      //   silenceDurationMs: 600
      // });
    }

    return config;
  }, [getSpeechConfig, getEnhancedSystemInstruction, settings.tone, settings.voice]);

  // Function to update live configuration during active session
  const updateLiveConfiguration = useCallback(async () => {
    if (!connected || !client) {
      console.log('🔄 [LiveAPI] Not connected, skipping live config update');
      return;
    }

    try {
      // Live configuration updated silently  
      // Note: 實際的配置更新已在 useEffect 中處理

    } catch (error) {
      console.error('❌ [LiveAPI] Failed to update live configuration:', error);
    }
  }, [connected, client]);

  // Trigger configuration update when settings change and Live API is connected
  useEffect(() => {
    if (connected && client) {
      // Settings changed, updating configuration silently
      updateLiveConfiguration();
    }
  }, [settings.voice, settings.tone, connected, updateLiveConfiguration, client]);

  // 音頻處理器已由 useAudioStreamer Hook 管理

  useEffect(() => {
    if (!client) return;

    const onOpen = () => {
      setConnected(true);
    };

    const onSetupComplete = () => {
      setReady(true);
    };

    const onClose = () => {
      setConnected(false);
      setReady(false);
    };

    const onError = (error: ErrorEvent) => {
      console.error('❌ LiveAPI 錯誤:', error.message || error);
    };

    const stopAudioStreamer = () => activeStreamerRef.current?.stop();

    const onAudio = (data: ArrayBuffer) => {
      const streamer = activeStreamerRef.current;

      if (!streamer) {
        console.warn('⚠️ [LiveAPI onAudio] AudioStreamer ref 為 null，無法播放音頻');
        // 嘗試從 ref 獲取最新狀態
        console.warn(`   → audioInitialized: ${audioInitialized} (stale), current ref: ${!!activeStreamerRef.current}`);
        return;
      }

      // Add debug log for audio data reception
      if (process.env.NODE_ENV === 'development') {
        // Log every 10th chunk to avoid spamming
        if (Math.random() < 0.1) {
          console.log(`🔊 [LiveAPI] Received audio chunk: ${data.byteLength} bytes`);
        }
      }
      streamer.addPCM16(new Uint8Array(data));
    };

    // 設置事件監聽器
    client
      .on("error", onError)
      .on("open", onOpen)
      .on("close", onClose)
      .on("setupcomplete", onSetupComplete)
      .on("interrupted", stopAudioStreamer)
      .on("audio", onAudio);

    return () => {
      client
        .off("error", onError)
        .off("open", onOpen)
        .off("close", onClose)
        .off("setupcomplete", onSetupComplete)
        .off("interrupted", stopAudioStreamer)
        .off("audio", onAudio)
        .disconnect();
    };
  }, [client, audioInitialized]);

  const connect = useCallback(async () => {
    if (!client) return;
    // 防止重複連線
    if (client.status === "connecting" || client.status === "reconnecting") {
      return;
    }

    // 等待 AudioStreamer 初始化完成
    if (!audioInitialized) {
      console.warn('⚠️ [LiveAPI] AudioStreamer 尚未初始化，等待初始化完成...');
      return;
    }

    // Ensure AudioContext is resumed before connecting
    if (activeStreamerRef.current) {
      try {
        console.log('🔊 [LiveAPI] Resuming audio context...');
        await activeStreamerRef.current.resume();
        console.log('✅ [LiveAPI] Audio context resumed');
      } catch (error) {
        console.error('❌ [LiveAPI] Failed to resume audio context:', error);
      }
    }

    // 在連接時才生成配置
    const currentConfig = createConfig();
    setConfig(currentConfig);

    // 只在需要時斷開連線
    if (client.status === "connected") {
      client.disconnect();
    }

    await client.connect(model, currentConfig);
  }, [client, createConfig, model, audioInitialized]);

  const disconnect = useCallback(async () => {
    // 只在連線狀態下斷開
    if (client.status === "connected" || client.status === "connecting") {
      client.disconnect();
    }
    setConnected(false);
    setReady(false);
  }, [setConnected, client]);

  return {
    client,
    config,
    setConfig,
    model,
    setModel,
    connected,
    ready,
    connect,
    disconnect,
    volume,
    updateLiveConfiguration,
    onTranscription: optionsRef.current.onTranscription,
  };
}
