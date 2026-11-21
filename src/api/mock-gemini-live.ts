import { EventEmitter } from 'eventemitter3';
import { LiveClientEventTypes } from './gemini-live';

/**
 * MockGenAILiveClient
 * 
 * 模擬 Gemini Live WebSocket API 客戶端
 * 用於單元測試與本機開發，完全不消耗真實 API Token。
 */
export class MockGenAILiveClient extends EventEmitter<LiveClientEventTypes> {
  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

  public get status() {
    return this._status;
  }

  public get isReady() {
    return this._status === 'connected';
  }

  /**
   * 模擬連線
   */
  async connect(): Promise<boolean> {
    this._status = 'connecting';
    console.log('🤖 [Mock API] 正在模擬連線至 Gemini Live...');

    return new Promise((resolve) => {
      setTimeout(() => {
        this._status = 'connected';
        console.log('✅ [Mock API] 模擬連線成功！(0 Token 消耗)');
        this.emit('open');
        this.emit('setupcomplete');
        resolve(true);

        // 💡 模擬連線成功後，自動觸發一輪測試對話轉錄
        this.simulateConversation();
      }, 300);
    });
  }

  private simulateConversation() {
    setTimeout(() => {
      console.log("🗣️ [Mock API] 模擬使用者說話中...");
      this.emit("input_transcription", {
        text: "你好！這是一條 Gemini Live 語音測試訊息。",
        isFinal: true
      });

      setTimeout(() => {
        console.log("🤖 [Mock API] 模擬 AI 語音回覆中...");
        this.emit("output_transcription", {
          text: "你好！我是 Mock Gemini AI，這是我自動回覆的語音紀錄！",
          isFinal: true
        });

        this.emit("turncomplete");
      }, 700);
    }, 500);
  }

  /**
   * 模擬發送文字訊息並觸發 AI 回覆
   */
  sendText(text: string) {
    if (this._status !== 'connected') {
      console.warn('⚠️ [Mock API] 尚未連線，無法發送訊息');
      return;
    }

    console.log(`💬 [Mock API] 收到使用者輸入: "${text}"`);
    this.emit('input_transcription', { text, isFinal: true });

    // 模擬 AI 思考與回應
    setTimeout(() => {
      const reply = `[Mock 回覆] 我收到了你的訊息：「${text}」。這是一條測試訊息！`;
      this.emit('output_transcription', { text: reply, isFinal: true });
      this.emit('turncomplete');
    }, 600);
  }

  /**
   * 模擬發送實時語音 PCM 封包 (填入 ArrayBuffer)
   */
  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    if (this._status !== 'connected') return;

    // 簡化模擬：收到語音時發送日誌
    this.emit('log', {
      date: new Date(),
      type: 'client.realtimeInput',
      message: `[Mock] 收到 ${chunks.length} 個語音音訊塊`
    });
  }

  /**
   * 模擬中斷對話
   */
  interrupt() {
    console.log('⚡ [Mock API] 模擬中斷 AI 回應');
    this.emit('interrupted');
  }

  /**
   * 模擬關閉連線
   */
  disconnect() {
    this._status = 'disconnected';
    console.log('🔌 [Mock API] 模擬連線已關閉');
    this.emit('close', new CloseEvent('close'));
  }
}
