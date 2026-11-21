/**
 * Google Gemini Speech-to-Text Service
 * 基於 Gemini 2.5 Flash 模型的語音轉文字服務（預設）
 * 參考：https://ai.google.dev/gemini-api/docs/audio
 */

import { AudioUtils } from '../audio/utils';

export interface GeminiSTTConfig {
  /** Gemini API 金鑰 */
  apiKey: string;
  /** 使用的模型 */
  model?: 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.0-flash-exp';
  /** 語言設定 */
  language?: string;
  /** 是否啟用詳細日誌 */
  enableLogging?: boolean;
}

export interface STTRequest {
  /** 音頻資料 (Blob 或 base64) */
  audio: Blob | string;
  /** 自定義轉錄提示 */
  prompt?: string;
  /** 音頻格式 (如果是 base64，需要指定) */
  mimeType?: string;
}

export interface STTResponse {
  success: boolean;
  /** 轉錄結果文字 */
  transcript: string;
  /** 處理時間 (ms) */
  processingTime: number;
  /** 音頻檔案資訊 */
  audioInfo?: {
    size: number;
    duration?: number;
    format: string;
  };
  /** 錯誤訊息 */
  error?: string;
}

/**
 * Gemini STT 服務類別
 */
export class GeminiSTTService {
  private readonly config: GeminiSTTConfig;
  private readonly baseUrl: string;
  private readonly enableLogging: boolean;

  // 支援的音頻格式
  private readonly supportedMimeTypes = [
    'audio/wav',
    'audio/mp3',
    'audio/aiff',
    'audio/aac',
    'audio/ogg',
    'audio/flac'
  ];

  constructor(config: GeminiSTTConfig) {
    this.config = {
      model: 'gemini-2.5-flash',
      language: 'zh-TW',
      enableLogging: false,
      ...config
    };

    this.enableLogging = this.config.enableLogging ?? false;
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent`;

    // 驗證必需參數
    if (!config.apiKey) {
      throw new Error('Gemini API key is required for STT service');
    }

    if (this.enableLogging) {
      console.log('🎤 [GeminiSTT] Service initialized:', {
        model: this.config.model,
        language: this.config.language,
        hasApiKey: !!config.apiKey
      });
    }
  }

  /**
   * 將語音轉換為文字
   */
  async transcribeAudio(request: STTRequest): Promise<STTResponse> {
    const startTime = Date.now();

    if (this.enableLogging) {
      console.log('🎯 [GeminiSTT] Starting transcription:', {
        audioType: request.audio instanceof Blob ? 'Blob' : 'base64',
        audioSize: request.audio instanceof Blob ? request.audio.size : 'unknown',
        hasCustomPrompt: !!request.prompt
      });
    }

    try {
      const { audioData, mimeType, audioSize } = await this.prepareAudioData(request);
      
      // 構建請求 payload
      const prompt = request.prompt || this.buildDefaultPrompt();
      const payload = {
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: audioData
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1, // 低溫度確保穩定轉錄
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 2048
        }
      };

      if (this.enableLogging) {
        console.log('📤 [GeminiSTT] Sending transcription request:', {
          audioSize: audioSize,
          mimeType: mimeType,
          promptLength: prompt.length
        });
      }

      const response = await fetch(`${this.baseUrl}?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      // 解析轉錄結果
      const transcript = this.extractTranscript(data);

      const result: STTResponse = {
        success: true,
        transcript,
        processingTime,
        audioInfo: {
          size: audioSize,
          format: mimeType
        }
      };

      if (this.enableLogging) {
        console.log('✅ [GeminiSTT] Transcription completed:', {
          transcriptLength: transcript.length,
          processingTime: `${processingTime}ms`,
          transcript: transcript.substring(0, 100) + (transcript.length > 100 ? '...' : '')
        });
      }

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown transcription error';
      
      console.error('❌ [GeminiSTT] Transcription failed:', error);

      return {
        success: false,
        transcript: '',
        processingTime,
        error: errorMessage
      };
    }
  }

  /**
   * 準備音頻資料
   */
  private async prepareAudioData(request: STTRequest): Promise<{
    audioData: string;
    mimeType: string;
    audioSize: number;
  }> {
    if (request.audio instanceof Blob) {
      // 處理 Blob 資料
      const mimeType = request.audio.type || 'audio/wav';
      
      if (!this.supportedMimeTypes.includes(mimeType)) {
        throw new Error(`Unsupported audio format: ${mimeType}`);
      }

      // 檢查檔案大小 (Gemini API 限制 20MB)
      if (request.audio.size > 20 * 1024 * 1024) {
        throw new Error('Audio file too large. Maximum size is 20MB.');
      }

      const arrayBuffer = await request.audio.arrayBuffer();
      const audioData = AudioUtils.arrayBufferToBase64(arrayBuffer);

      return {
        audioData,
        mimeType,
        audioSize: request.audio.size
      };
    } else {
      // 處理 base64 資料
      const mimeType = request.mimeType || 'audio/wav';
      
      if (!this.supportedMimeTypes.includes(mimeType)) {
        throw new Error(`Unsupported audio format: ${mimeType}`);
      }

      return {
        audioData: request.audio,
        mimeType,
        audioSize: Math.round((request.audio.length * 3) / 4) // base64 大小估算
      };
    }
  }


  /**
   * 建立預設轉錄提示
   */
  private buildDefaultPrompt(): string {
    const language = this.config.language === 'zh-TW' ? '繁體中文' : this.config.language;
    
    return `請將這段語音轉錄為${language}文字。要求：
1. 準確轉錄所有語音內容
2. 保持自然的語言表達
3. 如果有不清楚的地方，請用 [不清楚] 標記
4. 只返回轉錄文字，不需要其他說明

轉錄內容：`;
  }

  /**
   * 從 API 回應中提取轉錄文字
   */
  private extractTranscript(apiResponse: any): string {
    try {
      const candidates = apiResponse.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No transcription candidates in response');
      }

      const content = candidates[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error('No transcription text found in response');
      }

      // 清理轉錄文字
      return this.cleanTranscript(content);
    } catch (error) {
      console.error('Failed to extract transcript from response:', error);
      throw new Error('Failed to parse transcription response');
    }
  }

  /**
   * 清理轉錄文字
   */
  private cleanTranscript(text: string): string {
    return text
      .replace(/^轉錄內容：?/i, '') // 移除可能的提示前綴
      .replace(/^轉錄結果：?/i, '')
      .replace(/^語音內容：?/i, '')
      .trim();
  }

  /**
   * 測試服務連接
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // 創建一個簡單的測試音頻 (靜音)
      const testAudio = this.createTestAudio();
      
      const response = await this.transcribeAudio({
        audio: testAudio,
        prompt: 'This is a connection test. Please acknowledge this test.'
      });

      return {
        success: response.success,
        error: response.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  /**
   * 創建測試用的靜音音頻
   */
  private createTestAudio(): Blob {
    // 創建 1 秒的靜音 WAV 檔案
    const sampleRate = 16000;
    const duration = 1; // 1 秒
    const numSamples = sampleRate * duration;
    
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    
    // 靜音資料 (所有樣本都是 0)
    for (let i = 0; i < numSamples; i++) {
      view.setInt16(44 + i * 2, 0, true);
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * 獲取服務狀態
   */
  getServiceStatus() {
    return {
      configured: !!this.config.apiKey,
      model: this.config.model,
      language: this.config.language,
      supportedFormats: this.supportedMimeTypes
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<GeminiSTTConfig>) {
    Object.assign(this.config, newConfig);
    
    if (this.enableLogging) {
      console.log('🔧 [GeminiSTT] Configuration updated:', newConfig);
    }
  }
}