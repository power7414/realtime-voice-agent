import React from 'react';
import { render } from '@testing-library/react';
import AudioPulse from '../AudioPulse';

describe('AudioPulse 聲音脈衝 Component 自動化斷言測試', () => {
  it('應該在 active=true 時正確加上 active 樣式類別', () => {
    const { container } = render(<AudioPulse active={true} volume={0.5} />);
    const pulseDiv = container.querySelector('.audioPulse');

    expect(pulseDiv).not.toBeNull();
    expect(pulseDiv?.classList.contains('active')).toBe(true);
  });

  it('應該在 active=false 時不包含 active 樣式類別', () => {
    const { container } = render(<AudioPulse active={false} volume={0} />);
    const pulseDiv = container.querySelector('.audioPulse');

    expect(pulseDiv).not.toBeNull();
    expect(pulseDiv?.classList.contains('active')).toBe(false);
  });

  it('應該渲染出 3 條動態音量波浪線', () => {
    const { container } = render(<AudioPulse active={true} volume={0.8} />);
    const lines = container.querySelectorAll('.audioPulse > div');

    expect(lines.length).toBe(3);
  });

  it('【自動化 Pass/Fail 驗證】大音量 (volume=0.9) 的波浪高度必須顯著大於小音量 (volume=0.1)', () => {
    // 1. 渲染小音量 (volume = 0.1)
    const { container: smallContainer } = render(<AudioPulse active={true} volume={0.1} />);
    const smallLines = smallContainer.querySelectorAll<HTMLDivElement>('.audioPulse > div');
    const smallHeight = parseFloat(smallLines[1]?.style.height || '0');

    // 2. 渲染大音量 (volume = 0.9)
    const { container: largeContainer } = render(<AudioPulse active={true} volume={0.9} />);
    const largeLines = largeContainer.querySelectorAll<HTMLDivElement>('.audioPulse > div');
    const largeHeight = parseFloat(largeLines[1]?.style.height || '0');

    // 3. 自動 Pass/Fail 斷言：大音量高度必須顯著大於小音量
    expect(largeHeight).toBeGreaterThan(smallHeight);
  });

  it('【自動化 Pass/Fail 驗證】當無聲音或非發聲狀態 (active=false) 時，波浪線高度必須 100% 保持平靜 (4px)', () => {
    const { container } = render(<AudioPulse active={false} volume={0} />);
    const lines = container.querySelectorAll<HTMLDivElement>('.audioPulse > div');

    lines.forEach((line) => {
      expect(line.style.height).toBe('4px');
    });
  });
});
