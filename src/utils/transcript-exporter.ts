import { Message } from '../types/chat';

/**
 * 轉錄檔案匯出工具
 */

/**
 * 將對話訊息格式化為可閱讀的純文字格式
 */
export function formatTranscriptToText(roomName: string, messages: Message[]): string {
  const header = `=== 對話轉錄紀錄 - ${roomName} ===\n匯出時間：${new Date().toLocaleString('zh-TW')}\n訊息總數：${messages.length} 則\n----------------------------------------\n\n`;
  
  const content = messages
    .map((msg) => {
      const sender = msg.type === 'user' ? '【用戶】' : '【AI 助理】';
      const time = new Date(msg.timestamp).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      return `${sender} (${time}):\n${msg.content}\n`;
    })
    .join('\n');

  return header + content;
}

/**
 * 觸發瀏覽器下載文字檔
 */
export function downloadTranscriptAsFile(roomName: string, messages: Message[]): void {
  if (!messages || messages.length === 0) return;

  const textContent = formatTranscriptToText(roomName, messages);
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  const fileName = `transcript_${roomName}_${new Date().toISOString().slice(0, 10)}.txt`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
