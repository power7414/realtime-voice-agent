import { EventEmitter } from "eventemitter3";
import { UnifiedRealtimeEventTypes } from "./azure-realtime";

/**
 * MockAzureRealtimeClient
 * 
 * 專門用於 Azure Realtime API 的 0 Token 離線測試模擬器
 */
export class MockAzureRealtimeClient extends EventEmitter<UnifiedRealtimeEventTypes> {
  private _status: "connected" | "disconnected" | "connecting" = "disconnected";
  private _setupComplete: boolean = false;

  public get status() {
    return this._status;
  }

  public get isReady() {
    return this._status === "connected" && this._setupComplete;
  }

  async connect(): Promise<boolean> {
    console.log("🤖 [Mock Azure API] 正在模擬連線至 Azure Realtime...");
    this._status = "connecting";

    setTimeout(() => {
      this._status = "connected";
      this._setupComplete = true;
      console.log("✅ [Mock Azure API] 模擬連線成功！(0 Token 消耗)");
      
      this.emit("open");
      this.emit("setupcomplete");

      // 觸發自動對話模擬
      this.simulateConversation();
    }, 300);

    return true;
  }

  /**
   * Scripted demo conversation (offline, no API key needed).
   * A generic insurance customer-service scenario used for screenshots and the public demo;
   * it is not real model output.
   */
  private static readonly DEMO_SCRIPT: Array<{ role: "user" | "assistant"; text: string }> = [
    { role: "user", text: "你好，我收到簡訊說這個月保費扣款失敗，是怎麼回事？" },
    { role: "assistant", text: "您好，了解您收到扣款失敗的通知。請問您最近有換發或停用信用卡嗎？" },
    { role: "user", text: "有，我上個月換了一張新卡。" },
    { role: "assistant", text: "謝謝您說明。換卡後卡號或有效期限改變，系統就無法自動扣款。您可以在線上更新扣款卡片並補繳這期保費，需要我傳送連結給您嗎？" },
    { role: "user", text: "好，麻煩你。" },
    { role: "assistant", text: "已將補繳連結用簡訊傳到您登記的手機，完成後這期保費就會入帳。還有其他需要協助的地方嗎？" },
  ];

  private demoTimers: ReturnType<typeof setTimeout>[] = [];

  private simulateConversation() {
    let t = 600;
    for (const turn of MockAzureRealtimeClient.DEMO_SCRIPT) {
      this.demoTimers.push(setTimeout(() => {
        if (this._status !== "connected") return;
        if (turn.role === "user") {
          this.emit("input_transcription", { text: turn.text, isFinal: true });
        } else {
          this.emit("output_transcription", { text: turn.text, isFinal: true });
          this.emit("turncomplete");
        }
      }, t));
      t += turn.role === "user" ? 1200 : 2200;
    }
  }

  disconnect(): void {
    console.log("🔌 [Mock Azure API] 模擬連線已關閉");
    this._status = "disconnected";
    this._setupComplete = false;
    this.demoTimers.forEach(clearTimeout);
    this.demoTimers = [];
    this.emit("close", new CloseEvent("close"));
  }

  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>): void {
    // Mock 模式接收音訊 chunk 不做真實網路發送
  }

  updateSession(): void {
    this.emit("session_updated");
  }
}
