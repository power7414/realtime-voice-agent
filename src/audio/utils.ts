/**
 * Audio processing utilities for STT functionality
 * 整合現有的 card6 音頻處理基礎設施
 */

/**
 * 音頻格式轉換工具集合
 */
export class AudioUtils {
  
  /**
   * 將 ArrayBuffer 轉換為 Base64 字串
   * 使用批量處理提高效能，適合大檔案編碼
   * @param buffer - ArrayBuffer to convert
   * @returns Base64 encoded string
   */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';

    // 使用批量處理來提高性能（特別是大檔案）
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }

    try {
      return btoa(binary);
    } catch (error) {
      console.error('❌ [AudioUtils] Base64 編碼失敗:', error, {
        bufferSize: buffer.byteLength,
        binaryLength: binary.length,
        firstBytes: Array.from(bytes.slice(0, 20)).join(',')
      });
      // 降級方案：使用安全的編碼方式
      return btoa(String.fromCharCode(...Array.from(bytes)));
    }
  }

  /**
   * 將 Base64 字串轉換為 ArrayBuffer
   * @param base64 - Base64 encoded string
   * @returns ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    // 驗證和清理 Base64 字符串
    if (!base64 || typeof base64 !== 'string') {
      throw new Error('Invalid base64 data: missing or invalid string');
    }
    
    // 清理 Base64 字符串（移除可能的前綴和無效字符）
    const cleanBase64 = base64.replace(/^data:audio\/[^;]+;base64,/, '').replace(/[^A-Za-z0-9+/=]/g, '');
    
    if (cleanBase64.length === 0) {
      throw new Error('Invalid base64 data: empty string after cleanup');
    }
    
    try {
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return bytes.buffer;
    } catch (error) {
      console.error('❌ [AudioUtils] Base64 解碼失敗:', error, {
        originalLength: base64.length,
        cleanedLength: cleanBase64.length,
        sampleData: cleanBase64.substring(0, 100) + '...'
      });
      throw new Error(`Base64 decoding failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 將 Base64 字串轉換為 Blob
   * @param base64 - Base64 encoded string
   * @param mimeType - MIME type for the blob (default: 'application/octet-stream')
   * @returns Blob
   */
  static base64ToBlob(base64: string, mimeType: string = 'application/octet-stream'): Blob {
    const arrayBuffer = this.base64ToArrayBuffer(base64);
    return new Blob([arrayBuffer], { type: mimeType });
  }

  /**
   * 將 Blob 轉換為 ArrayBuffer
   * @param blob - Blob to convert
   * @returns Promise that resolves to ArrayBuffer
   */
  static async blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * 將 ArrayBuffer 轉換為 WAV 格式 Blob
   * 針對 STT 需求進行優化：16kHz, 16-bit, 單聲道
   * 
   * @param arrayBuffer - Raw PCM audio data
   * @param sampleRate - Sample rate (default: 16000 for STT)
   * @param channels - Number of channels (default: 1 for mono)
   * @param bitsPerSample - Bits per sample (default: 16)
   * @returns WAV format Blob
   */
  static arrayBufferToWav(
    arrayBuffer: ArrayBuffer, 
    sampleRate: number = 16000,
    channels: number = 1,
    bitsPerSample: number = 16
  ): Blob {
    const pcmData = new Int16Array(arrayBuffer);
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const wavDataLength = pcmData.length * bytesPerSample;
    const wavFileLength = 44 + wavDataLength;
    
    const wavBuffer = new ArrayBuffer(wavFileLength);
    const view = new DataView(wavBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, wavFileLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, channels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample
    writeString(36, 'data');
    view.setUint32(40, wavDataLength, true);
    
    // Copy PCM data
    const wavArray = new Uint8Array(wavBuffer);
    const pcmBytes = new Uint8Array(arrayBuffer);
    wavArray.set(pcmBytes, 44);
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  /**
   * 檢測音頻數據是否為有效的 WAV 格式
   * @param arrayBuffer - Audio data to check
   * @returns boolean indicating if it's valid WAV
   */
  static isValidWav(arrayBuffer: ArrayBuffer): boolean {
    if (arrayBuffer.byteLength < 44) return false;
    
    const view = new DataView(arrayBuffer);
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1), 
      view.getUint8(2),
      view.getUint8(3)
    );
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11)
    );
    
    return riff === 'RIFF' && wave === 'WAVE';
  }

  /**
   * 獲取 WAV 檔案的音頻資訊
   * @param arrayBuffer - WAV audio data
   * @returns Audio information object
   */
  static getWavInfo(arrayBuffer: ArrayBuffer): {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    duration: number;
    dataSize: number;
  } | null {
    if (!this.isValidWav(arrayBuffer)) return null;
    
    const view = new DataView(arrayBuffer);
    const channels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    const dataSize = view.getUint32(40, true);
    
    const bytesPerSample = bitsPerSample / 8;
    const samplesPerChannel = dataSize / (channels * bytesPerSample);
    const duration = samplesPerChannel / sampleRate;
    
    return {
      sampleRate,
      channels,
      bitsPerSample,
      duration,
      dataSize
    };
  }

  /**
   * 重新採樣音頻數據到指定的採樣率
   * 簡化版本，適用於降採樣場景（如 48kHz → 16kHz）
   * 
   * @param inputBuffer - Input PCM data (Int16Array)
   * @param inputSampleRate - Input sample rate
   * @param outputSampleRate - Target sample rate
   * @returns Resampled PCM data
   */
  static resamplePCM16(
    inputBuffer: Int16Array, 
    inputSampleRate: number, 
    outputSampleRate: number
  ): Int16Array {
    if (inputSampleRate === outputSampleRate) {
      return inputBuffer;
    }
    
    const ratio = inputSampleRate / outputSampleRate;
    const outputLength = Math.round(inputBuffer.length / ratio);
    const outputBuffer = new Int16Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
      const inputIndex = Math.round(i * ratio);
      outputBuffer[i] = inputBuffer[Math.min(inputIndex, inputBuffer.length - 1)];
    }
    
    return outputBuffer;
  }

  /**
   * 計算音頻數據的RMS音量
   * @param pcmData - PCM audio data (Int16Array)
   * @returns RMS volume (0-1)
   */
  static calculateRMS(pcmData: Int16Array): number {
    let sum = 0;
    for (let i = 0; i < pcmData.length; i++) {
      const sample = pcmData[i] / 32768; // Normalize to -1 to 1
      sum += sample * sample;
    }
    return Math.sqrt(sum / pcmData.length);
  }

  /**
   * 檢測音頻數據中是否包含語音（簡化版本）
   * 基於音量和持續時間的檢測
   * 
   * @param pcmData - PCM audio data
   * @param sampleRate - Audio sample rate
   * @param options - Detection options
   * @returns boolean indicating if speech is detected
   */
  static detectSpeech(
    pcmData: Int16Array, 
    sampleRate: number,
    options: {
      minVolume?: number;
      minDuration?: number;
    } = {}
  ): boolean {
    const { minVolume = 0.01, minDuration = 0.3 } = options;
    
    const rms = this.calculateRMS(pcmData);
    const duration = pcmData.length / sampleRate;
    
    return rms >= minVolume && duration >= minDuration;
  }

  /**
   * 為音頻錄製創建優化的 MediaRecorder 配置
   * 針對 STT 需求進行優化
   * 
   * @param preferredMimeType - Preferred MIME type
   * @returns MediaRecorder configuration
   */
  static getOptimalRecorderConfig(preferredMimeType?: string): {
    mimeType: string;
    audioBitsPerSecond?: number;
  } {
    // STT 優化的配置優先級
    const sttOptimizedTypes = [
      'audio/webm;codecs=opus',
      'audio/wav',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];
    
    // 如果指定了首選格式且支援，優先使用
    if (preferredMimeType && MediaRecorder.isTypeSupported(preferredMimeType)) {
      return {
        mimeType: preferredMimeType,
        audioBitsPerSecond: 16000 // 16kbps for STT
      };
    }
    
    // 遍歷 STT 優化的格式
    for (const mimeType of sttOptimizedTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return {
          mimeType,
          audioBitsPerSecond: 16000
        };
      }
    }
    
    // 降級到基本支援
    return {
      mimeType: 'audio/webm' // Most browsers support this
    };
  }

  /**
   * 檢查瀏覽器對 MediaRecorder 的支援情況
   * @returns Support information object
   */
  static getMediaRecorderSupport(): {
    isSupported: boolean;
    supportedTypes: string[];
    recommendedType: string | null;
  } {
    const isSupported = typeof MediaRecorder !== 'undefined';
    
    if (!isSupported) {
      return {
        isSupported: false,
        supportedTypes: [],
        recommendedType: null
      };
    }
    
    const testTypes = [
      'audio/webm;codecs=opus',
      'audio/wav', 
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/3gpp',
      'audio/mp3'
    ];
    
    const supportedTypes = testTypes.filter(type => MediaRecorder.isTypeSupported(type));
    const config = this.getOptimalRecorderConfig();
    
    return {
      isSupported: true,
      supportedTypes,
      recommendedType: config.mimeType
    };
  }
}

/**
 * 音頻錄製相關的常數和配置
 */
export const AudioConfig = {
  // STT 優化的音頻設定
  STT_SAMPLE_RATE: 16000,
  STT_CHANNELS: 1,
  STT_BITS_PER_SAMPLE: 16,
  
  // 音頻品質設定
  HIGH_QUALITY_SAMPLE_RATE: 48000,
  STANDARD_SAMPLE_RATE: 44100,
  
  // 錄製限制
  MAX_RECORDING_DURATION: 60, // seconds
  MIN_RECORDING_DURATION: 0.1, // seconds - 降低最小錄音時間以支援切換式錄音
  
  // 語音檢測閾值
  SPEECH_DETECTION: {
    MIN_VOLUME: 0.01,
    MIN_DURATION: 0.3
  }
} as const;

export default AudioUtils;