import { EventEmitter } from "eventemitter3";
import { UnifiedRealtimeEventTypes } from "./azure-realtime";
import { playDemoScript } from "./demo-script";

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

  private cancelDemo: () => void = () => {};

  private simulateConversation() {
    this.cancelDemo = playDemoScript(
      (text) => this.emit("input_transcription", { text, isFinal: true }),
      (text) => { this.emit("output_transcription", { text, isFinal: true }); this.emit("turncomplete"); },
      () => this._status === "connected",
    );
  }

  disconnect(): void {
    console.log("🔌 [Mock Azure API] 模擬連線已關閉");
    this._status = "disconnected";
    this._setupComplete = false;
    this.cancelDemo();
    this.emit("close", new CloseEvent("close"));
  }

  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>): void {
    // Mock 模式接收音訊 chunk 不做真實網路發送
  }

  updateSession(): void {
    this.emit("session_updated");
  }
}
