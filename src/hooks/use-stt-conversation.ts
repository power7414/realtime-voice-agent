/**
 * Hook for managing STT+LLM+TTS conversation mode
 * 整合新的 STTVoiceProcessor 和 AudioRecording 為完整的語音對話系統
 * 支援 Gemini STT + Azure OpenAI LLM + Gemini TTS 架構
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { STTVoiceProcessor, STTVoiceProcessorConfig } from '../audio/processor';
import { AudioRecorder } from '../audio/recorder';
import { useChatManager } from './use-chat-manager';
import { createUserMessage, createAssistantMessage } from '../utils/message-factory';
import { useSettings } from '../stores/settings-store';
import { AudioUtils } from '../audio/utils';
import { TTSPlayer } from '../audio/tts-player';

export interface UseSTTConversationConfig {
  /** Gemini API key */
  geminiApiKey?: string;
  apiKey?: string; // 簡化的 API key 參數
  /** Azure OpenAI configuration */
  azureOpenAI?: {
    endpoint?: string;
    apiKey?: string;
    deploymentName?: string;
    apiVersion?: string;
  };
  azureConfig?: {
    endpoint?: string;
    apiKey?: string;
    deploymentName?: string;
    apiVersion?: string;
  }; // 相容性別名
  /** Voice processor configuration */
  voiceProcessor?: Partial<STTVoiceProcessorConfig>;
  /** Enable logging */
  enableLogging?: boolean;
  /** Auto-start TTS playback */
  autoPlayTTS?: boolean;
  /** Language for STT */
  language?: string;
  /** Enable/disable this Hook */
  enabled?: boolean;
  /** Settings from SettingsContext */
  settings?: any;

  // 新增轉錄回調支援
  /** Callback when user speech is transcribed */
  onUserTranscript?: (transcript: string) => void;
  /** Callback when LLM response is generated */
  onAssistantResponse?: (response: string) => void;
  /** Callback when TTS starts playing */
  onTTSStart?: () => void;
  /** Callback when TTS finishes playing */
  onTTSEnd?: () => void;
}

export interface UseSTTConversationResult {
  // Connection State (類似其他模式)
  connected: boolean;
  ready: boolean;
  volume?: number; // 為了與其他 API 統一，新增 volume 屬性（可選）

  // Recording State
  isRecording: boolean;
  isProcessingVoice: boolean;
  audioLevel: number;
  recordingDuration: number;

  // TTS State
  isSpeaking: boolean;
  
  // Permissions
  hasAudioPermission: boolean;
  audioPermissionError: string | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  startVoiceRecording: () => Promise<void>;
  stopVoiceRecording: () => Promise<void>;
  sendTextWithTTS: (text: string) => Promise<void>;
  speakText: (text: string) => Promise<void>;
  
  // Permission Management
  requestAudioPermission: () => Promise<boolean>;
  
  // Configuration
  updateConfig: (config: Partial<UseSTTConversationConfig>) => void;
  
  // Error Handling
  error: string | null;
  clearError: () => void;
  
  // Service Status (包含新的三段式架構)
  serviceStatus: {
    stt: boolean;
    llm: boolean;
    tts: boolean;
    overall: boolean;
  };
  
  // Browser Support
  isSupported: boolean;
}

export function useSTTConversation(
  config: UseSTTConversationConfig = {}
): UseSTTConversationResult {
  const { activeChatRoom, addMessage, chatRooms } = useChatManager();
  const { settings, ttsStylePrompt, systemPrompt } = useSettings();

  // 使用傳入的配置
  const effectiveAzureConfig = config.azureOpenAI || config.azureConfig;
  const effectiveGeminiKey = config.geminiApiKey || config.apiKey || process.env.REACT_APP_GEMINI_API_KEY;
  
  // 檢查是否有有效配置，但不能在這裡早期返回（違反 hooks 規則）
  const hasValidConfig = Boolean(
    effectiveGeminiKey && 
    effectiveAzureConfig?.endpoint && 
    effectiveAzureConfig?.apiKey
  );
  
  // 配置變化時才記錄（避免過多日誌）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [STTConversation] 配置驗證:', {
        hasGeminiKey: !!effectiveGeminiKey,
        hasAzureEndpoint: !!effectiveAzureConfig?.endpoint,
        hasAzureKey: !!effectiveAzureConfig?.apiKey,
        azureDeployment: effectiveAzureConfig?.deploymentName,
        configSource: 'props',
        hasValidConfig
      });
    }
  }, [effectiveGeminiKey, effectiveAzureConfig?.endpoint, effectiveAzureConfig?.apiKey, effectiveAzureConfig?.deploymentName, hasValidConfig]);
  
  // State - 必須在所有情況下調用
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<UseSTTConversationConfig>(config);
  
  // Services
  const voiceProcessorRef = useRef<STTVoiceProcessor | null>(null);
  const ttsPlayerRef = useRef<TTSPlayer>(
    new TTSPlayer({
      sampleRate: 24000,
      enableLogging: currentConfig.enableLogging
    })
  );

  // Audio Recording - 直接使用 AudioRecorder
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasAudioPermission, setHasAudioPermission] = useState(false);
  const [audioPermissionError, setAudioPermissionError] = useState<string | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 檢測瀏覽器支援
  const supportInfo = AudioUtils.getMediaRecorderSupport();
  const isSupported = supportInfo.isSupported && typeof AudioContext !== 'undefined';

  // 連接服務 - 初始化 VoiceProcessor
  const connect = useCallback(async () => {
    // 如果配置無效，不執行任何操作
    if (!hasValidConfig) {
      console.warn('⚠️ [STTConversation] 無效配置，無法連接');
      return;
    }
    
    // 只在有效配置且開發環境時輸出日誌
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 [STTConversation] 嘗試連接 STT+LLM+TTS 服務...', {
        currentlyConnected: connected,
        apiKey: currentConfig.geminiApiKey ? 'present' : 'missing',
        settings: {
          llm: settings.models.llm,
          tts: settings.models.tts,
          voice: settings.voice
        }
      });
    }

    if (connected || voiceProcessorRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ [STTConversation] 已經連接或服務已初始化，跳過重複連接');
      }
      return;
    }

    setError(null);
    setConnected(true);
    setReady(false);

    try {
      // 使用 effective 配置
      const azureConfig = effectiveAzureConfig || {
        endpoint: process.env.REACT_APP_AZURE_OPENAI_ENDPOINT || '',
        apiKey: process.env.REACT_APP_AZURE_OPENAI_API_KEY || '',
        deploymentName: process.env.REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1',
        apiVersion: process.env.REACT_APP_AZURE_OPENAI_API_VERSION || '2024-12-01-preview'
      };

      console.log('📝 [STTConversation] Azure 配置檢查:', {
        hasEndpoint: !!azureConfig.endpoint,
        hasApiKey: !!azureConfig.apiKey,
        deploymentName: azureConfig.deploymentName,
        apiVersion: azureConfig.apiVersion,
        configSource: 'props'
      });

      // 初始化 STT Voice Processor
      const processorConfig: STTVoiceProcessorConfig = {
        geminiApiKey: effectiveGeminiKey || '',
        azureOpenAI: {
          endpoint: azureConfig.endpoint || '',
          apiKey: azureConfig.apiKey || '',
          deploymentName: azureConfig.deploymentName || '',
          apiVersion: azureConfig.apiVersion || '2024-10-01-preview'
        },
        models: {
          stt: 'gemini-2.5-flash',
          llm: azureConfig.deploymentName || '',
          tts: settings.models.tts as 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts'
        },
        voice: {
          voiceName: settings.voice,
          stylePrompt: ttsStylePrompt
        },
        language: currentConfig.language || 'zh-TW',
        enableLogging: currentConfig.enableLogging,
        ...currentConfig.voiceProcessor
      };

      console.log('🔧 [STTConversation] 開始初始化 STTVoiceProcessor...');
      voiceProcessorRef.current = new STTVoiceProcessor(processorConfig);
      console.log('✅ [STTConversation] STTVoiceProcessor 初始化成功');
      
      // 檢查服務狀態
      const status = voiceProcessorRef.current.getServiceStatus();
      console.log('📊 [STTConversation] 服務狀態檢查:', status);
      
      if (!status.overall) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ [STTConversation] 金鑰不足，啟用 Mock STT-TTS 離線測試模式');
          setReady(true);
          setConnected(true);
          setError(null);
          return;
        }
        throw new Error('Voice processing services are not fully available');
      }

      console.log('✅ STT+LLM+TTS services initialized successfully');
      console.log('🔄 [STTConversation] 設置 ready = true');
      setReady(true);
      setError(null);

    } catch (err) {
      console.error('❌ [STTConversation] 初始化失敗:', err);
      console.error('❌ [STTConversation] 錯誤詳情:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize services';
      setError(errorMessage);
      setConnected(false);
      setReady(false);
      
      // 清理
      voiceProcessorRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasValidConfig]); // 只依賴配置有效性，避免過度重新執行

  // 清理函數將在組件卸載時自動調用 disconnect

  // 斷開連接
  const disconnect = useCallback(() => {
    // 只在實際有連接時才輸出斷開日誌，避免重複渲染造成的日誌洪水
    if (connected && process.env.NODE_ENV === 'development') {
      console.log('🔌 Disconnecting STT conversation services');
    }
    
    // 停止 TTS 播放
    ttsPlayerRef.current.stop();

    // 停止錄音
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }

    // 清理計時器
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // 清理服務
    voiceProcessorRef.current = null;
    audioChunksRef.current = [];

    // 重置狀態
    console.log('🔄 [STTConversation] 重置狀態: connected=false, ready=false');
    setConnected(false);
    setReady(false);
    setIsProcessingVoice(false);
    setIsSpeaking(false);
    setIsRecording(false);
    setAudioLevel(0);
    setRecordingDuration(0);
    setError(null);
  }, [connected]);

  // 組件卸載清理將通過 useEffect return 函數處理

  // 開始語音錄製
  const startVoiceRecording = useCallback(async () => {
    if (!connected || !ready) {
      setError('Please connect to STT services first');
      return;
    }

    // 請求麥克風權限
    if (!hasAudioPermission) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
          }
        });
        stream.getTracks().forEach(track => track.stop());
        setHasAudioPermission(true);
        setAudioPermissionError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Permission denied';
        setAudioPermissionError(errorMessage);
        setError('Microphone permission is required');
        return;
      }
    }

    try {
      console.log('🎤 [STTConversation] Starting voice recording...');

      // 創建錄音器
      audioRecorderRef.current = new AudioRecorder(16000);
      audioChunksRef.current = [];

      // 監聽音頻數據
      audioRecorderRef.current.on('data', (base64: string) => {
        try {
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          audioChunksRef.current.push(bytes);
        } catch (err) {
          console.error('[STTConversation] 音頻片段處理失敗:', err);
        }
      });

      // 監聽音量
      audioRecorderRef.current.on('volume', (volume: number) => {
        setAudioLevel(volume);
      });

      // 開始錄音
      await audioRecorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingStartTimeRef.current = Date.now();

      // 更新錄音時長
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((Date.now() - recordingStartTimeRef.current) / 1000);
      }, 100);

      console.log('✅ [STTConversation] Recording started');
    } catch (err) {
      console.error('❌ Failed to start recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');

      // 清理
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stop();
        audioRecorderRef.current = null;
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      audioChunksRef.current = [];
    }
  }, [connected, ready, hasAudioPermission]);

  // 停止語音錄製並處理
  const stopVoiceRecording = useCallback(async () => {
    if (!isRecording || !audioRecorderRef.current) {
      return;
    }

    setIsProcessingVoice(true);
    setError(null);

    // 離線 Mock 模式防護
    if (!voiceProcessorRef.current) {
      console.log('🤖 [STTConversation] 觸發 Mock STT-TTS 對話模擬');
      audioRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
      
      setTimeout(() => {
        setIsProcessingVoice(false);
        const userText = "你好！這是一條 STT-TTS 語音測試訊息。";
        const aiText = "你好！我是 Mock STT-TTS 助理，這是我自動產生的回覆紀錄！";
        
        if (currentConfig.onUserTranscript) {
          currentConfig.onUserTranscript(userText);
        }
        
        setTimeout(() => {
          if (currentConfig.onAssistantResponse) {
            currentConfig.onAssistantResponse(aiText);
          }
        }, 700);
      }, 500);
      return;
    }

    try {
      console.log('🛑 [STTConversation] Stopping voice recording and processing...');

      // 停止錄音器
      audioRecorderRef.current.stop();

      // 清理計時器
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      setIsRecording(false);
      setAudioLevel(0);

      // 等待最後的音頻片段
      await new Promise(resolve => setTimeout(resolve, 100));

      // 合併音頻片段
      const chunks = audioChunksRef.current;
      if (chunks.length === 0) {
        throw new Error('No audio data recorded');
      }

      console.log(`📊 [STTConversation] Processing ${chunks.length} audio chunks`);

      // 計算總長度並合併
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedArray = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combinedArray.set(chunk, offset);
        offset += chunk.length;
      }

      // 轉換為 WAV 格式
      const audioBlob = AudioUtils.arrayBufferToWav(
        combinedArray.buffer,
        16000,  // 採樣率
        1,      // 單聲道
        16      // 16-bit
      );

      console.log('📊 [STTConversation] Audio recorded:', {
        size: audioBlob.size,
        type: audioBlob.type,
        duration: recordingDuration.toFixed(2) + 's'
      });

      if (!activeChatRoom) {
        throw new Error('No active chat room');
      }

      // 獲取聊天歷史
      const currentChatRoom = chatRooms.find(room => room.id === activeChatRoom);
      const chatHistory = currentChatRoom?.messages || [];

      // 使用新的 STT-TTS 流程處理音頻
      console.log(`🎙️ [STT-Conversation] 開始處理語音輸入，使用 systemPrompt (長度: ${systemPrompt.length})`);
      console.log(`📝 [STT-Conversation] SystemPrompt 預覽: "${systemPrompt.substring(0, 100).replace(/\n/g, '\\n')}..."`);

      const result = await voiceProcessorRef.current.processVoiceInput({
        audioInput: audioBlob,
        mimeType: audioBlob.type,
        chatHistory,
        systemPrompt: systemPrompt
      });

      if (!result.success) {
        throw new Error(result.error || 'Voice processing failed');
      }

      console.log('✅ [STTConversation] STT-TTS processing completed:', {
        transcript: result.transcript?.substring(0, 50) + (result.transcript && result.transcript.length > 50 ? '...' : ''),
        response: result.response.substring(0, 50) + '...',
        pipeline: result.pipeline,
        metrics: result.metrics
      });

      // 調用轉錄回調
      if (result.transcript && currentConfig.onUserTranscript) {
        currentConfig.onUserTranscript(result.transcript);
      }

      // 調用助理回應回調
      if (currentConfig.onAssistantResponse) {
        currentConfig.onAssistantResponse(result.response);
      }

      // 添加用戶訊息 (使用 STT 轉錄結果)
      const userMessage = createUserMessage(result.transcript || '[音頻轉錄失敗]');
      await addMessage(activeChatRoom, userMessage);

      // 添加助理回應
      const assistantMessage = createAssistantMessage(result.response);
      await addMessage(activeChatRoom, assistantMessage);

      // 播放 TTS 音頻（如果有）
      if (result.audioBase64 && currentConfig.autoPlayTTS !== false) {
        console.log('🔊 [STTConversation] Attempting to play TTS audio:', {
          hasAudio: !!result.audioBase64,
          audioLength: result.audioBase64?.length,
          audioFormat: result.audioFormat,
          autoPlayEnabled: currentConfig.autoPlayTTS
        });

        await ttsPlayerRef.current.play(result.audioBase64, {
          onStart: () => {
            setIsSpeaking(true);
            currentConfig.onTTSStart?.();
          },
          onEnd: () => {
            setIsSpeaking(false);
            currentConfig.onTTSEnd?.();
          },
          onError: (error) => {
            console.error('[STTConversation] TTS 播放錯誤:', error);
            setIsSpeaking(false);
          }
        });
      } else {
        console.log('⏭️ [STTConversation] Skipping TTS playback:', {
          hasAudio: !!result.audioBase64,
          autoPlayEnabled: currentConfig.autoPlayTTS
        });
      }

    } catch (err) {
      console.error('❌ Voice processing failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Voice processing failed';
      setError(errorMessage);
      
      // 添加錯誤訊息到聊天
      if (activeChatRoom) {
        const errorMsg = createAssistantMessage(`抱歉，語音處理時發生錯誤：${errorMessage}`);
        await addMessage(activeChatRoom, errorMsg);
      }
    } finally {
      setIsProcessingVoice(false);
      audioRecorderRef.current = null;
      audioChunksRef.current = [];
    }
  }, [isRecording, recordingDuration, activeChatRoom, chatRooms, addMessage, currentConfig, systemPrompt]);

  // 發送文字並合成語音
  const sendTextWithTTS = useCallback(async (text: string) => {
    if (!connected || !ready || !voiceProcessorRef.current) {
      setError('Please connect to STT services first');
      return;
    }

    if (!activeChatRoom) {
      setError('No active chat room');
      return;
    }

    setIsProcessingVoice(true);
    setError(null);

    try {
      console.log('💬 [STTConversation] Processing text with TTS:', text.substring(0, 50) + '...');

      // 獲取聊天歷史
      const currentChatRoom = chatRooms.find(room => room.id === activeChatRoom);
      const chatHistory = currentChatRoom?.messages || [];

      // 添加用戶訊息
      const userMessage = createUserMessage(text.trim());
      await addMessage(activeChatRoom, userMessage);

      // 處理文字輸入 (跳過 STT)
      console.log(`💬 [STT-Conversation] 開始處理文字輸入，使用 systemPrompt (長度: ${systemPrompt.length})`);
      console.log(`📝 [STT-Conversation] SystemPrompt 預覽: "${systemPrompt.substring(0, 100).replace(/\n/g, '\\n')}..."`);

      const result = await voiceProcessorRef.current.processTextInput(text, chatHistory, {
        systemPrompt: systemPrompt,
        voice: {
          voiceName: settings.voice,
          stylePrompt: ttsStylePrompt
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Text processing failed');
      }

      console.log('✅ [STTConversation] Text processing completed');

      // 添加助理回應
      const assistantMessage = createAssistantMessage(result.response);
      await addMessage(activeChatRoom, assistantMessage);

      // 播放 TTS 音頻
      if (result.audioBase64) {
        await ttsPlayerRef.current.play(result.audioBase64, {
          onStart: () => {
            setIsSpeaking(true);
            currentConfig.onTTSStart?.();
          },
          onEnd: () => {
            setIsSpeaking(false);
            currentConfig.onTTSEnd?.();
          },
          onError: (error) => {
            console.error('[STTConversation] TTS 播放錯誤:', error);
            setIsSpeaking(false);
          }
        });
      }

    } catch (err) {
      console.error('❌ Text processing failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Text processing failed';
      setError(errorMessage);
      
      // 添加錯誤訊息
      const errorMsg = createAssistantMessage(`抱歉，處理時發生錯誤：${errorMessage}`);
      await addMessage(activeChatRoom, errorMsg);
    } finally {
      setIsProcessingVoice(false);
    }
  }, [connected, ready, activeChatRoom, chatRooms, addMessage, settings.voice, ttsStylePrompt, currentConfig, systemPrompt]);

  // 僅合成語音
  const speakText = useCallback(async (text: string) => {
    if (!connected || !ready || !voiceProcessorRef.current) {
      setError('Please connect to TTS service first');
      return;
    }

    try {
      console.log('🔊 [STTConversation] Synthesizing speech:', text.substring(0, 50) + '...');
      
      const audioBase64 = await voiceProcessorRef.current.synthesizeOnly(text, {
        voiceName: settings.voice,
        stylePrompt: ttsStylePrompt
      });

      await ttsPlayerRef.current.play(audioBase64, {
        onStart: () => {
          setIsSpeaking(true);
          currentConfig.onTTSStart?.();
        },
        onEnd: () => {
          setIsSpeaking(false);
          currentConfig.onTTSEnd?.();
        },
        onError: (error) => {
          console.error('[STTConversation] TTS 播放錯誤:', error);
          setIsSpeaking(false);
        }
      });
    } catch (err) {
      console.error('❌ Speech synthesis failed:', err);
      setError(err instanceof Error ? err.message : 'Speech synthesis failed');
    }
  }, [connected, ready, settings.voice, ttsStylePrompt, currentConfig]);

  // 請求音頻權限（已整合到 startVoiceRecording 中，保留以維持 API 相容）
  const requestAudioPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      stream.getTracks().forEach(track => track.stop());
      setHasAudioPermission(true);
      setAudioPermissionError(null);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Permission denied';
      setAudioPermissionError(errorMessage);
      return false;
    }
  }, []);

  // 更新配置
  const updateConfig = useCallback((newConfig: Partial<UseSTTConversationConfig>) => {
    setCurrentConfig(prev => ({ ...prev, ...newConfig }));
    
    // 更新 VoiceProcessor 配置
    if (voiceProcessorRef.current) {
      if (newConfig.language) {
        voiceProcessorRef.current.updateConfig({ language: newConfig.language });
      }
      if (newConfig.voiceProcessor) {
        voiceProcessorRef.current.updateConfig(newConfig.voiceProcessor);
      }
    }
  }, []);

  // 清理錯誤
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 獲取服務狀態
  const serviceStatus = voiceProcessorRef.current?.getServiceStatus() || {
    stt: { configured: false },
    llm: { configured: false },
    tts: { configured: false },
    overall: false
  };

  // 簡化服務狀態為 boolean
  const simplifiedServiceStatus = {
    stt: serviceStatus.stt?.configured || false,
    llm: serviceStatus.llm?.configured || false,
    tts: serviceStatus.tts?.configured || false,
    overall: serviceStatus.overall || false
  };

  // 組件卸載清理 - 使用 ref 避免依賴變化導致的重複清理
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;
  
  useEffect(() => {
    return () => {
      // 使用最新的 disconnect 函數，但不依賴它
      disconnectRef.current();
    };
  }, []); // 空依賴陣列，只在組件掛載/卸載時執行

  return {
    // Connection State
    connected,
    ready,
    
    // Recording State
    isRecording,
    isProcessingVoice,
    audioLevel,
    recordingDuration,

    // TTS State
    isSpeaking,

    // Permissions
    hasAudioPermission,
    audioPermissionError,
    
    // Actions
    connect,
    disconnect,
    startVoiceRecording,
    stopVoiceRecording,
    sendTextWithTTS,
    speakText,
    
    // Permission Management
    requestAudioPermission,
    
    // Configuration
    updateConfig,
    
    // Error Handling
    error,
    clearError,
    
    // Service Status
    serviceStatus: simplifiedServiceStatus,
    
    // Browser Support
    isSupported
  };
}