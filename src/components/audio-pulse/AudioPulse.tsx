import "./audio-pulse.scss";
import React, { useEffect, useRef } from "react";
import c from "classnames";

const lineCount = 3;

export type AudioPulseProps = {
  active: boolean;  // 標記 AI 是否處於發聲活躍狀態
  volume: number;  // 傳入的 AI 說話實時音量分貝 (0.0 ~ 1.0)
  hover?: boolean;
};

/**
 * AudioPulse Component
 * 
 * 嚴格邏輯：
 * 只有當 AI 處於發聲活躍 (active=true) 且實體有音量輸出 (volume > 0) 時才躍動聲波；
 * 平時非發聲或無聲音狀態時，100% 保持完全平靜靜止 (4px)。
 */
export default function AudioPulse({ active, volume, hover }: AudioPulseProps) {
  const lines = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    // 當非發聲狀態或音量為 0 時，100% 靜止歸零
    if (!active || volume <= 0) {
      lines.current.forEach((line) => {
        if (line) line.style.height = '4px';
      });
      return;
    }

    let animationFrameId: number;

    const update = () => {
      lines.current.forEach((line, i) => {
        if (line) {
          // 根據傳入的真實 AI 音量分貝，動態計算 3 條波浪線高度
          const factor = i === 1 ? 28 : 16;
          const calculatedHeight = Math.min(
            26,
            Math.max(4, 4 + volume * factor + Math.random() * 2)
          );
          line.style.height = `${calculatedHeight}px`;
        }
      });

      animationFrameId = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [active, volume]);

  return (
    <div className={c("audioPulse", { active: active && volume > 0, hover })}>
      {Array(lineCount)
        .fill(null)
        .map((_, i) => (
          <div
            key={i}
            ref={(el) => (lines.current[i] = el!)}
            style={{ animationDelay: `${i * 133}ms` }}
          />
        ))}
    </div>
  );
}