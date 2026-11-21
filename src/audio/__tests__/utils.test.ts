import { AudioUtils } from '../utils';

describe('AudioUtils 音訊工具函數單元測試', () => {
  it('應該能成功進行 ArrayBuffer 與 Base64 的雙向轉換', () => {
    // 建立 10 個 bytes 的測試數據
    const originalBytes = new Uint8Array([72, 101, 108, 108, 111, 87, 111, 114, 108, 100]); // "HelloWorld"
    const originalBuffer = originalBytes.buffer;

    // 1. ArrayBuffer -> Base64
    const base64 = AudioUtils.arrayBufferToBase64(originalBuffer);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(0);

    // 2. Base64 -> ArrayBuffer
    const restoredBuffer = AudioUtils.base64ToArrayBuffer(base64);
    const restoredBytes = new Uint8Array(restoredBuffer);

    // 3. 驗證還原後的內容與原本 100% 一致
    expect(restoredBytes).toEqual(originalBytes);
  });

  it('應該能正確清理 base64 Data URI 前綴並解碼', () => {
    const rawBase64 = 'SGVsbG9Xb3JsZA==';
    const prefixedBase64 = 'data:audio/mp3;base64,SGVsbG9Xb3JsZA==';

    const buffer1 = AudioUtils.base64ToArrayBuffer(rawBase64);
    const buffer2 = AudioUtils.base64ToArrayBuffer(prefixedBase64);

    expect(new Uint8Array(buffer1)).toEqual(new Uint8Array(buffer2));
  });

  it('當傳入無效的 Base64 時應該拋出明確的錯誤', () => {
    expect(() => {
      AudioUtils.base64ToArrayBuffer('');
    }).toThrow('Invalid base64 data');
  });

  it('應該能成功把 PCM 資料轉為帶有 44-byte Header 的 WAV 檔案', () => {
    // 建立 100 個 16-bit PCM 聲道數據 (200 bytes)
    const pcmSamples = new Int16Array(100);
    for (let i = 0; i < pcmSamples.length; i++) {
      pcmSamples[i] = Math.sin(i * 0.1) * 32767;
    }
    const pcmBuffer = pcmSamples.buffer;

    // 轉換為 WAV Blob
    const wavBlob = AudioUtils.arrayBufferToWav(pcmBuffer, 16000, 1, 16);

    // 驗證生成的 Blob 屬性
    expect(wavBlob.type).toBe('audio/wav');
    // 標準 WAV 標頭 44 位元組 + 原本 200 位元組 = 244 位元組
    expect(wavBlob.size).toBe(44 + pcmBuffer.byteLength);
  });
});
