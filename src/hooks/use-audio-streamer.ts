/**
 * 共用的音頻串流器 Hook
 * 統一管理 AudioStreamer 的初始化、volume 追蹤和生命週期
 *
 * 用於 use-live-api 和 use-azure-realtime
 */

import { useEffect, useRef, useState } from 'react';
import { AudioStreamer } from '../audio/streamer';
import { audioContext } from '../utils/audio-context';
import VolMeterWorket from '../audio/worklets/vol-meter';

export interface UseAudioStreamerOptions {
  /** 音頻上下文 ID，用於區分不同的音頻源 */
  contextId: string;

  /** VU meter worklet ID */
  workletId: string;

  /** 是否啟用音頻串流器 */
  enabled?: boolean;

  /** 顯示名稱（用於日誌） */
  displayName?: string;

  /** 是否啟用除錯日誌 */
  enableDebugLog?: boolean;
}

export interface UseAudioStreamerResult {
  /** AudioStreamer 實例 */
  audioStreamer: AudioStreamer | null;

  /** 當前音量 (0-1) */
  volume: number;

  /** 是否已初始化 */
  isInitialized: boolean;

  /** 初始化錯誤 */
  error: Error | null;
}

/**
 * 統一的音頻串流器 Hook
 *
 * @example
 * ```ts
 * const { audioStreamer, volume } = useAudioStreamer({
 *   contextId: 'gemini-audio',
 *   workletId: 'gemini-vumeter',
 *   enabled: true,
 *   displayName: 'Gemini'
 * });
 *
 * // 在事件處理中使用
 * const onAudio = (data: ArrayBuffer) => {
 *   audioStreamer?.addPCM16(new Uint8Array(data));
 * };
 * ```
 */
export function useAudioStreamer(options: UseAudioStreamerOptions): UseAudioStreamerResult {
  const {
    contextId,
    workletId,
    enabled = true,
    displayName = 'Audio',
    enableDebugLog = false
  } = options;

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const [volume, setVolume] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 追蹤狀態變化，避免重複初始化
  const enabledRef = useRef<boolean | undefined>(undefined);
  const initializingRef = useRef(false);

  useEffect(() => {
    const isEnabled = enabled !== false;

    // 除錯日誌
    if (enableDebugLog) {
      console.log(`🔍 [${displayName}] 音頻串流器狀態檢查:`, {
        enabled: isEnabled,
        previousEnabled: enabledRef.current,
        hasStreamer: !!audioStreamerRef.current,
        isInitializing: initializingRef.current
      });
    }

    // 避免重複執行相同的操作
    if (enabledRef.current === isEnabled && !!audioStreamerRef.current === isInitialized) {
      return;
    }

    enabledRef.current = isEnabled;

    // 情況 1: 需要初始化
    if (isEnabled && !audioStreamerRef.current && !initializingRef.current) {
      console.log(`🔧 [${displayName}] 初始化音頻串流器...`);
      initializingRef.current = true;
      setError(null);

      audioContext({ id: contextId })
        .then((audioCtx: AudioContext) => {
          const streamer = new AudioStreamer(audioCtx);
          audioStreamerRef.current = streamer;

          return streamer.addWorklet<any>(workletId, VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          });
        })
        .then(() => {
          console.log(`✅ [${displayName}] 音頻串流器初始化完成`);
          setIsInitialized(true);
          initializingRef.current = false;
        })
        .catch((err) => {
          console.error(`❌ [${displayName}] 音頻串流器初始化失敗:`, err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsInitialized(false);
          initializingRef.current = false;
          audioStreamerRef.current = null;
        });
    }

    // 情況 2: 需要停用
    else if (!isEnabled && audioStreamerRef.current) {
      console.log(`🔇 [${displayName}] 停用音頻串流器`);

      try {
        audioStreamerRef.current.stop();
      } catch (err) {
        console.warn(`⚠️ [${displayName}] 停止音頻串流器時發生錯誤:`, err);
      }

      audioStreamerRef.current = null;
      setIsInitialized(false);
      setVolume(0);
    }

    // 情況 3: 未啟用且未初始化（初始狀態）
    else if (!isEnabled && !audioStreamerRef.current && !initializingRef.current) {
      if (enableDebugLog) {
        console.log(`⏸️ [${displayName}] 音頻串流器未啟用`);
      }
      setIsInitialized(false);
    }
  }, [enabled, contextId, workletId, displayName, enableDebugLog, isInitialized]);

  // 組件卸載時清理
  useEffect(() => {
    return () => {
      if (audioStreamerRef.current) {
        console.log(`🧹 [${displayName}] 清理音頻串流器`);
        try {
          audioStreamerRef.current.stop();
        } catch (err) {
          console.warn(`⚠️ [${displayName}] 清理時發生錯誤:`, err);
        }
        audioStreamerRef.current = null;
      }
    };
  }, [displayName]);

  return {
    audioStreamer: audioStreamerRef.current,
    volume,
    isInitialized,
    error
  };
}
