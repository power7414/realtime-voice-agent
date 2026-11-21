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
    { role: "user", text: "Hi, I got a text saying this month's premium payment failed. What happened?" },
    { role: "assistant", text: "I'm sorry about that. Have you recently replaced or cancelled the credit card used for your premium?" },
    { role: "user", text: "Yes, I got a new card last month." },
    { role: "assistant", text: "Thanks. When the card number or expiry date changes, the automatic payment can't go through. You can update your card and pay this month's premium online. Would you like me to send you the link?" },
    { role: "user", text: "Yes, please." },
    { role: "assistant", text: "Done. I've texted the payment link to your registered phone number; once you finish, this month's premium will be credited. Is there anything else I can help with?" },
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
