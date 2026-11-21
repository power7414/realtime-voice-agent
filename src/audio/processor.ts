/**
 * STT-TTS Voice Processor Service
 * 整合 STT → LLM → TTS 完整流程的語音處理器
 * 基於 Gemini STT + Azure OpenAI Chat + Gemini TTS 架構
 */

import { GeminiSTTService } from '../api/gemini-stt';
import { AzureOpenAIChatService } from '../api/azure-chat';
import { GeminiTTSService, TTSOptions, GeminiVoiceName } from '../api/gemini-tts';
import { Message } from '../types/chat';

export interface STTVoiceProcessorConfig {
  /** Gemini API key for STT and TTS */
  geminiApiKey: string;
  /** Azure OpenAI configuration for LLM */
  azureOpenAI: {
    endpoint: string;
    apiKey: string;
    deploymentName: string;
    apiVersion?: string;
  };
  /** Models configuration */
  models: {
    stt: 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.0-flash-exp';
    llm: string; // Azure OpenAI deployment name
    tts: 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts';
  };
  /** Voice settings for TTS */
  voice?: {
    voiceName?: GeminiVoiceName;
    stylePrompt?: string;
  };
  /** Language preferences */
  language?: string;
  /** Enable detailed logging */
  enableLogging?: boolean;
}

export interface STTVoiceProcessingOptions {
  /** Audio input to process */
  audioInput: Blob | string;
  /** Audio MIME type (required for base64 input) */
  mimeType?: string;
  /** Chat history for context */
  chatHistory?: Message[];
  /** Custom system prompt */
  systemPrompt?: string;
  /** Override voice settings for TTS */
  voice?: {
    voiceName?: GeminiVoiceName;
    stylePrompt?: string;
  };
  /** Custom processing options */
  processing?: {
    skipSTT?: boolean;     // If you already have text input
    skipTTS?: boolean;     // If you only want text response
    customSTTPrompt?: string;
  };
}

export interface STTVoiceProcessingResult {
  success: boolean;
  /** STT transcription result */
  transcript?: string;
  /** LLM generated response text */
  response: string;
  /** TTS audio as base64 string (if TTS was used) */
  audioBase64?: string;
  /** Audio format information */
  audioFormat?: string;
  /** Processing pipeline information */
  pipeline: string;
  /** Performance metrics */
  metrics: {
    sttDuration?: number;
    llmDuration?: number;
    ttsDuration?: number;
    totalDuration: number;
  };
  /** Error information if processing failed */
  error?: string;
}

/**
 * 統一的 STT-TTS 語音處理服務
 * 整合 STT、LLM、TTS 三個階段的完整語音對話流程
 */
export class STTVoiceProcessor {
  private readonly sttService: GeminiSTTService;
  private readonly chatService: AzureOpenAIChatService;
  private readonly ttsService: GeminiTTSService;
  private readonly config: STTVoiceProcessorConfig;
  private readonly enableLogging: boolean;

  constructor(config: STTVoiceProcessorConfig) {
    this.config = config;
    this.enableLogging = config.enableLogging ?? false;

    // 驗證配置
    if (!config.geminiApiKey) {
      throw new Error('Gemini API key is required');
    }
    if (!config.azureOpenAI.endpoint || !config.azureOpenAI.apiKey || !config.azureOpenAI.deploymentName) {
      throw new Error('Azure OpenAI endpoint, API key, and deployment name are required');
    }

    try {
      // 初始化 STT 服務
      this.sttService = new GeminiSTTService({
        apiKey: config.geminiApiKey,
        model: config.models.stt,
        language: config.language,
        enableLogging: this.enableLogging
      });

      // 初始化 LLM 服務
      this.chatService = new AzureOpenAIChatService({
        endpoint: config.azureOpenAI.endpoint,
        apiKey: config.azureOpenAI.apiKey,
        deploymentName: config.azureOpenAI.deploymentName,
        apiVersion: config.azureOpenAI.apiVersion,
        enableLogging: this.enableLogging
      });

      // 初始化 TTS 服務
      this.ttsService = new GeminiTTSService({
        apiKey: config.geminiApiKey,
        model: config.models.tts,
        voice: config.voice,
        enableLogging: this.enableLogging
      });

      if (this.enableLogging) {
        console.log('🎙️ [STTVoiceProcessor] All services initialized successfully');
      }

    } catch (error) {
      console.error('❌ [STTVoiceProcessor] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 處理完整的 STT → LLM → TTS 流程
   */
  async processVoiceInput(options: STTVoiceProcessingOptions): Promise<STTVoiceProcessingResult> {
    const startTime = Date.now();
    const metrics = {
      sttDuration: 0,
      llmDuration: 0,
      ttsDuration: 0,
      totalDuration: 0
    };

    if (this.enableLogging) {
      console.log('🚀 [STTVoiceProcessor] Starting voice processing pipeline:', {
        hasAudio: !!options.audioInput,
        audioType: options.audioInput instanceof Blob ? 'Blob' : 'string',
        skipSTT: options.processing?.skipSTT,
        skipTTS: options.processing?.skipTTS,
        hasHistory: options.chatHistory && options.chatHistory.length > 0
      });
    }

    let pipeline = '';
    
    try {
      let transcript = '';

      // Step 1: STT (Speech-to-Text) - 如果有音頻輸入且未跳過
      if (!options.processing?.skipSTT && options.audioInput) {
        const sttStart = Date.now();
        pipeline += 'STT';

        if (this.enableLogging) {
          console.log('🎤 [STTVoiceProcessor] Phase 1: Speech-to-Text...');
        }

        const sttResult = await this.sttService.transcribeAudio({
          audio: options.audioInput,
          mimeType: options.mimeType,
          prompt: options.processing?.customSTTPrompt
        });

        metrics.sttDuration = Date.now() - sttStart;

        if (!sttResult.success) {
          throw new Error(`STT failed: ${sttResult.error}`);
        }

        transcript = sttResult.transcript;
        
        if (this.enableLogging) {
          console.log('✅ [STTVoiceProcessor] STT completed:', {
            transcript: transcript.substring(0, 100) + (transcript.length > 100 ? '...' : ''),
            duration: `${metrics.sttDuration}ms`
          });
        }
      }

      // Step 2: LLM (Large Language Model) - 處理文字對話
      const llmStart = Date.now();
      pipeline += (pipeline ? ' → ' : '') + 'LLM';

      if (this.enableLogging) {
        console.log('🤖 [STTVoiceProcessor] Phase 2: Language Model processing...');
      }

      const chatResult = await this.chatService.sendMessage({
        userMessage: transcript,
        chatHistory: options.chatHistory,
        systemPrompt: options.systemPrompt || this.buildDefaultSystemPrompt()
      });

      metrics.llmDuration = Date.now() - llmStart;

      if (!chatResult.success) {
        throw new Error(`LLM failed: ${chatResult.error}`);
      }

      const response = chatResult.response;

      if (this.enableLogging) {
        console.log('✅ [STTVoiceProcessor] LLM completed:', {
          responseLength: response.length,
          duration: `${metrics.llmDuration}ms`,
          usage: chatResult.usage
        });
      }

      // Step 3: TTS (Text-to-Speech) - 如果未跳過
      let audioBase64: string | undefined;
      let audioFormat: string | undefined;

      if (!options.processing?.skipTTS) {
        const ttsStart = Date.now();
        pipeline += ' → TTS';

        if (this.enableLogging) {
          console.log('🔊 [STTVoiceProcessor] Phase 3: Text-to-Speech...');
        }

        const ttsOptions: TTSOptions = {
          text: response,
          voice: {
            voiceName: options.voice?.voiceName || this.config.voice?.voiceName,
            stylePrompt: options.voice?.stylePrompt || this.config.voice?.stylePrompt
          }
        };

        const audioBlob = await this.ttsService.textToSpeech(ttsOptions);
        audioBase64 = await this.blobToBase64(audioBlob);
        audioFormat = 'audio/wav';

        metrics.ttsDuration = Date.now() - ttsStart;

        if (this.enableLogging) {
          console.log('✅ [STTVoiceProcessor] TTS completed:', {
            audioSize: audioBase64 ? Math.round(audioBase64.length / 1024) + 'KB' : 'N/A',
            duration: `${metrics.ttsDuration}ms`
          });
        }
      }

      metrics.totalDuration = Date.now() - startTime;

      const result: STTVoiceProcessingResult = {
        success: true,
        transcript: transcript || undefined,
        response,
        audioBase64,
        audioFormat,
        pipeline,
        metrics
      };

      if (this.enableLogging) {
        console.log('🎉 [STTVoiceProcessor] Pipeline completed successfully:', {
          pipeline,
          totalDuration: `${metrics.totalDuration}ms`,
          metrics: {
            stt: metrics.sttDuration ? `${metrics.sttDuration}ms` : 'skipped',
            llm: `${metrics.llmDuration}ms`,
            tts: metrics.ttsDuration ? `${metrics.ttsDuration}ms` : 'skipped'
          }
        });
      }

      return result;

    } catch (error) {
      metrics.totalDuration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      
      console.error('❌ [STTVoiceProcessor] Pipeline failed:', error);

      return {
        success: false,
        response: '',
        pipeline: pipeline || 'FAILED',
        metrics,
        error: errorMessage
      };
    }
  }

  /**
   * 僅處理文字輸入 (跳過 STT)
   */
  async processTextInput(text: string, chatHistory?: Message[], options?: {
    systemPrompt?: string;
    voice?: { voiceName?: GeminiVoiceName; stylePrompt?: string; };
    skipTTS?: boolean;
  }): Promise<STTVoiceProcessingResult> {
    return this.processVoiceInput({
      audioInput: text, // 將作為 transcript 使用
      chatHistory,
      systemPrompt: options?.systemPrompt,
      voice: options?.voice,
      processing: {
        skipSTT: true,
        skipTTS: options?.skipTTS
      }
    });
  }

  /**
   * 僅語音合成 (跳過 STT 和 LLM)
   */
  async synthesizeOnly(text: string, options?: {
    voiceName?: GeminiVoiceName;
    stylePrompt?: string;
  }): Promise<string> {
    const ttsOptions: TTSOptions = {
      text,
      voice: {
        voiceName: options?.voiceName || this.config.voice?.voiceName,
        stylePrompt: options?.stylePrompt || this.config.voice?.stylePrompt
      }
    };

    const audioBlob = await this.ttsService.textToSpeech(ttsOptions);
    const audioBase64 = await this.blobToBase64(audioBlob);

    return audioBase64;
  }

  /**
   * 建立預設系統提示詞
   */
  private buildDefaultSystemPrompt(): string {
    return `你是一個友善且有用的語音助理。請用自然、簡潔的方式回應用戶的問題。

回應要求：
1. 保持友善和專業的語調
2. 回應長度適中，適合語音播放 (建議 50-200 字)
3. 如果問題不清楚，請禮貌地要求澄清
4. 使用繁體中文回應

當前時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;
  }

  /**
   * 測試所有服務的連接
   */
  async testAllServices(): Promise<{
    stt: { success: boolean; error?: string };
    llm: { success: boolean; error?: string };
    tts: { success: boolean; error?: string };
    overall: boolean;
  }> {
    const results = {
      stt: await this.sttService.testConnection(),
      llm: await this.chatService.testConnection(),
      tts: { success: GeminiTTSService.isAudioSupported(), error: GeminiTTSService.isAudioSupported() ? undefined : 'Audio not supported' },
      overall: false
    };

    results.overall = results.stt.success && results.llm.success && results.tts.success;

    if (this.enableLogging) {
      console.log('🧪 [STTVoiceProcessor] Service tests completed:', results);
    }

    return results;
  }

  /**
   * 獲取所有服務狀態
   */
  getServiceStatus() {
    const sttStatus = this.sttService.getServiceStatus();
    const llmStatus = this.chatService.getServiceStatus();
    const ttsStatus = { configured: true }; // GeminiTTSService doesn't expose status
    
    return {
      stt: sttStatus,
      llm: llmStatus,
      tts: ttsStatus,
      overall: !!(sttStatus.configured && llmStatus.configured && ttsStatus.configured)
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<STTVoiceProcessorConfig>) {
    Object.assign(this.config, newConfig);
    
    // 更新各服務的配置
    if (newConfig.language) {
      this.sttService.updateConfig({ language: newConfig.language });
    }
    
    if (newConfig.voice) {
      this.ttsService.updateVoiceConfig(newConfig.voice);
    }

    if (newConfig.azureOpenAI) {
      this.chatService.updateConfig(newConfig.azureOpenAI);
    }
    
    if (this.enableLogging) {
      console.log('🔧 [STTVoiceProcessor] Configuration updated:', newConfig);
    }
  }

  /**
   * 將 Blob 轉換為 Base64 字串
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1]; // Remove data:audio/...;base64, prefix
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
      reader.readAsDataURL(blob);
    });
  }
}