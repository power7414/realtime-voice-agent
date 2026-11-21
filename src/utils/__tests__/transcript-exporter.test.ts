import { formatTranscriptToText } from '../transcript-exporter';
import { Message } from '../../types/chat';

describe('TranscriptExporter 匯出工具測試', () => {
  it('應該能正確將對話訊息陣列格式化為文字檔案內容', () => {
    const mockMessages: Message[] = [
      { id: '1', type: 'user', content: '你好 AI', timestamp: new Date('2026-08-20T10:00:00') },
      { id: '2', type: 'assistant', content: '你好！請問有什麼我可以幫忙的？', timestamp: new Date('2026-08-20T10:00:02') }
    ];

    const result = formatTranscriptToText('測試對話室', mockMessages);

    expect(result).toContain('=== 對話轉錄紀錄 - 測試對話室 ===');
    expect(result).toContain('【用戶】');
    expect(result).toContain('你好 AI');
    expect(result).toContain('【AI 助理】');
    expect(result).toContain('你好！請問有什麼我可以幫忙的？');
  });
});
