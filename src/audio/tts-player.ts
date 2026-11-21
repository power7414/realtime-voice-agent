/**
 * TTS Audio Player - 專門處理 TTS 音頻播放
 *
 * 設計目標：
 * - 從 use-stt-conversation 提取 135 行的播放邏輯
 * - 提供簡單的 Promise-based API
 * - 處理 Base64 編碼的 PCM 音頻數據
 * - 支援播放事件回調
 *
 * @example
 * ```typescript
 * const player = new TTSPlayer({ sampleRate: 24000, enableLogging: true });
 *
 * await player.play(base64Audio, {
 *   onStart: () => console.log('開始播放'),
 *   onEnd: () => console.log('播放結束'),
 *   onError: (err) => console.error('播放錯誤:', err)
 * });
 *
 * // 停止播放
 * player.stop();
 *
 * // 檢查狀態
 * if (player.isPlaying) {
 *   console.log('正在播放中...');
 * }
 * ```
 */

import { AudioUtils } from './utils';

/**
 * TTSPlayer 配置選項
 */
export interface TTSPlayerConfig {
  /** 音頻採樣率 (預設 24000 Hz) */
  sampleRate?: number;
  /** 音頻聲道數 (預設 1 = 單聲道) */
  channels?: number;
  /** 音頻位元深度 (預設 16-bit) */
  bitsPerSample?: number;
  /** 啟用詳細日誌 (預設 false) */
  enableLogging?: boolean;
}

/**
 * 播放事件回調函數
 */
export interface TTSPlayerCallbacks {
  /** 播放開始時調用 */
  onStart?: () => void;
  /** 播放結束時調用 */
  onEnd?: () => void;
  /** 播放錯誤時調用 */
  onError?: (error: Error) => void;
}

/**
 * TTS 音頻播放器類別
 *
 * 職責：
 * 1. 接收 Base64 編碼的 PCM 音頻數據
 * 2. 解碼並轉換為 WAV 格式
 * 3. 使用 HTML5 Audio API 播放
 * 4. 管理播放狀態和生命週期
 * 5. 提供播放事件回調
 */
export class TTSPlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private readonly config: Required<TTSPlayerConfig>;

  /**
   * 創建 TTS 播放器實例
   */
  constructor(config: TTSPlayerConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 24000,
      channels: config.channels ?? 1,
      bitsPerSample: config.bitsPerSample ?? 16,
      enableLogging: config.enableLogging ?? false
    };

    this.log('TTSPlayer 初始化完成', {
      sampleRate: this.config.sampleRate,
      channels: this.config.channels,
      bitsPerSample: this.config.bitsPerSample
    });
  }

  /**
   * 播放 Base64 編碼的 PCM 音頻
   *
   * @param audioBase64 - Base64 編碼的 PCM 音頻數據
   * @param callbacks - 播放事件回調（可選）
   * @returns Promise - 播放完成後 resolve
   */
  async play(audioBase64: string, callbacks?: TTSPlayerCallbacks): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.log('準備播放 TTS 音頻');
        this.stop();

        // 驗證輸入
        if (!audioBase64 || typeof audioBase64 !== 'string') {
          throw new Error('無效的音頻數據：Base64 字串為空或格式錯誤');
        }

        // 清理並解碼 Base64
        const cleanBase64 = this.cleanBase64String(audioBase64);
        if (cleanBase64.length === 0) {
          throw new Error('無效的音頻數據：Base64 字串清理後為空');
        }

        this.log('Base64 字串清理完成', {
          originalLength: audioBase64.length,
          cleanedLength: cleanBase64.length
        });

        // 轉換為 WAV Blob
        const audioBlob = this.base64ToWavBlob(cleanBase64);
        const audioUrl = URL.createObjectURL(audioBlob);
        this.currentAudioUrl = audioUrl;

        // 創建 Audio 元素
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;

        // 音頻載入完成事件
        audio.addEventListener('loadeddata', async () => {
          try {
            this.log('音頻載入完成，開始播放', {
              duration: audio.duration,
              readyState: audio.readyState
            });
            callbacks?.onStart?.();
            await audio.play();
          } catch (playError) {
            // 自動播放可能被瀏覽器阻止（需要用戶互動）
            console.warn('[TTSPlayer] 自動播放被阻止:', playError);
            callbacks?.onError?.(new Error('自動播放被瀏覽器阻止，需要用戶互動'));
            this.cleanup();
            resolve(); // 不視為失敗
          }
        });

        // 播放結束事件
        audio.addEventListener('ended', () => {
          this.log('播放完成');
          callbacks?.onEnd?.();
          this.cleanup();
          resolve();
        });

        // 播放錯誤事件
        audio.addEventListener('error', () => {
          const errorCode = audio.error?.code;
          const errorMessage = audio.error?.message || '未知錯誤';

          // HTML5 Media Error 代碼: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
          const errorTypes = ['', 'ABORTED', 'NETWORK', 'DECODE', 'SRC_NOT_SUPPORTED'];
          const errorType = errorTypes[errorCode || 0] || 'UNKNOWN';

          const error = new Error(`音頻播放失敗: ${errorMessage} (${errorType})`);

          console.error('[TTSPlayer] 播放錯誤:', {
            code: errorCode,
            type: errorType,
            message: errorMessage,
            readyState: audio.readyState,
            networkState: audio.networkState
          });

          callbacks?.onError?.(error);
          this.cleanup();
          reject(error);
        });

        this.log('開始載入音頻');
        audio.load();

      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[TTSPlayer] TTS 設置失敗:', error);
        callbacks?.onError?.(error);
        this.cleanup();
        reject(error);
      }
    });
  }

  /**
   * 停止當前播放
   */
  stop(): void {
    if (this.currentAudio) {
      this.log('停止播放');
      this.currentAudio.pause();
      this.cleanup();
    }
  }

  /**
   * 檢查是否正在播放
   */
  get isPlaying(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }

  /**
   * 清理資源
   * @private
   */
  private cleanup(): void {
    this.currentAudio = null;
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
  }

  /**
   * 清理 Base64 字串
   * - 移除 data URI scheme 前綴
   * - 移除非 Base64 字符
   * @private
   */
  private cleanBase64String(base64: string): string {
    return base64
      .replace(/^data:audio\/[^;]+;base64,/, '')
      .replace(/[^A-Za-z0-9+/=]/g, '');
  }

  /**
   * Base64 轉 WAV Blob
   * @private
   */
  private base64ToWavBlob(cleanBase64: string): Blob {
    try {
      // 解碼 Base64
      const binaryString = atob(cleanBase64);
      this.log('Base64 解碼成功', { binaryLength: binaryString.length });

      // 轉換為 Uint8Array
      const uint8Array = Uint8Array.from(binaryString, c => c.charCodeAt(0));

      // 創建 ArrayBuffer（避免類型問題）
      const arrayBuffer = new ArrayBuffer(uint8Array.length);
      const view = new Uint8Array(arrayBuffer);
      view.set(uint8Array);

      // 添加 WAV header
      const wavBlob = AudioUtils.arrayBufferToWav(
        arrayBuffer,
        this.config.sampleRate,
        this.config.channels,
        this.config.bitsPerSample
      );

      if (wavBlob.size === 0) {
        throw new Error('WAV Blob 大小為 0');
      }

      this.log('WAV Blob 創建成功', {
        blobSize: wavBlob.size,
        blobType: wavBlob.type
      });

      return wavBlob;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Base64 解碼失敗: ${errorMessage}`);
    }
  }

  /**
   * 日誌輸出
   * @private
   */
  private log(message: string, data?: any): void {
    if (this.config.enableLogging) {
      if (data) {
        console.log(`[TTSPlayer] ${message}`, data);
      } else {
        console.log(`[TTSPlayer] ${message}`);
      }
    }
  }
}
