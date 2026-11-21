/**
 * Azure OpenAI Realtime API Client
 * 類似 GenAI Live Client 的架構，用於與 Azure OpenAI Realtime API 通信
 */

import { EventEmitter } from "eventemitter3";
import { debugLog } from "../utils/debug-config";
import { AudioUtils } from "../audio/utils";

// 統一的 Realtime 事件類型，用於橋接不同 API
export interface UnifiedRealtimeEventTypes {
  // 連線相關事件
  audio: (data: ArrayBuffer) => void;
  close: (event: CloseEvent) => void;
  content: (data: any) => void;
  error: (error: ErrorEvent) => void;
  interrupted: () => void;
  speech_started: () => void;
  audio_cleared: () => void;
  open: () => void;
  setupcomplete: () => void;
  turncomplete: () => void;

  // 轉錄事件
  input_transcription: (transcription: { text: string; isFinal?: boolean }) => void;
  output_transcription: (transcription: { text: string; isFinal?: boolean }) => void;

  // Session 管理 (簡化版，與 Gemini 不同)
  session_created: (data: { id: string }) => void;
  session_updated: () => void;
}

export interface AzureRealtimeConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
  systemPrompt?: string;
  vadSettings?: {
    enabled: boolean;
    sensitivity: number;
    silenceDuration: number;
  };
}

export class AzureOpenAIRealtimeClient extends EventEmitter<UnifiedRealtimeEventTypes> {
  private websocket: WebSocket | null = null;
  private config: AzureRealtimeConfig;
  private _status: "connected" | "disconnected" | "connecting" = "disconnected";
  private _setupComplete: boolean = false;
  private sessionId: string | null = null;
  private _isResponseActive: boolean = false;  // 追蹤是否有正在進行的回應

  public get status() {
    return this._status;
  }
  
  public get isReady() {
    return this._status === "connected" && this._setupComplete;
  }

  constructor(config: AzureRealtimeConfig) {
    super();
    this.config = config;
  }

  // 取得 VAD 配置
  private getVADConfig() {
    const vadSettings = this.config.vadSettings || {
      enabled: true,
      sensitivity: 0.3,  // 降低敏感度：0.5 → 0.3
      silenceDuration: 500  // 增加靜音時間：200ms → 500ms
    };
    
    if (!vadSettings.enabled) {
      return null; // 禁用 VAD
    }
    
    return {
      type: "server_vad",
      threshold: vadSettings.sensitivity,
      prefix_padding_ms: 300,  // 語音前的緩衝時間
      silence_duration_ms: vadSettings.silenceDuration
    };
  }
  
  // 更新 VAD 設定
  updateVADSettings(vadSettings: { enabled: boolean; sensitivity: number; silenceDuration: number }) {
    this.config.vadSettings = vadSettings;
    
    // 如果已連線，重新發送 session 配置
    if (this.isReady) {
      this.sendSessionUpdate();
      debugLog.info('VAD 設定已更新並套用');
    } else {
      debugLog.info('VAD 設定已更新，將在下次連線時套用');
    }
  }

  private getWebSocketUrl(): string {
    const baseUrl = this.config.endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
    // 根據 Azure OpenAI Realtime API 文檔，API key 需要在 URL 參數中傳遞
    const url = `${baseUrl}/openai/realtime?api-version=${this.config.apiVersion}&deployment=${this.config.deploymentName}&api-key=${this.config.apiKey}`;
    console.log('🔗 [Azure Realtime] WebSocket URL:', url.replace(this.config.apiKey, '***HIDDEN***'));
    return url;
  }

  private getHeaders(): Record<string, string> {
    return {
      'api-key': this.config.apiKey,
      'OpenAI-Beta': 'realtime=v1'
    };
  }

  async connect(): Promise<boolean> {
    if (this._status === "connected" || this._status === "connecting") {
      console.log('⚠️ Azure Realtime API 已經連接或正在連接，跳過');
      return false;
    }

    console.log('🔄 [Azure Realtime] 開始連線...', {
      endpoint: this.config.endpoint,
      deploymentName: this.config.deploymentName,
      apiVersion: this.config.apiVersion,
      hasApiKey: !!this.config.apiKey
    });

    this._status = "connecting";
    this._setupComplete = false;
    
    try {
      const url = this.getWebSocketUrl();
      
      console.log('🌐 [Azure Realtime] 創建 WebSocket 連線...');
      // 創建 WebSocket 連線
      this.websocket = new WebSocket(url);
      
      console.log('🎧 [Azure Realtime] 設定事件監聽器...');
      // 設定事件監聽器
      this.websocket.onopen = this.onOpen.bind(this);
      this.websocket.onmessage = this.onMessage.bind(this);
      this.websocket.onerror = this.onError.bind(this);
      this.websocket.onclose = this.onClose.bind(this);
      
      // 等待連線完成
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);
        
        const onOpen = () => {
          clearTimeout(timeout);
          resolve();
        };
        
        const onError = (error: Event) => {
          clearTimeout(timeout);
          reject(error);
        };
        
        if (this.websocket) {
          this.websocket.addEventListener('open', onOpen, { once: true });
          this.websocket.addEventListener('error', onError, { once: true });
        }
      });
      
      return true;
      
    } catch (error) {
      console.error("❌ Azure OpenAI Realtime API 連線失敗:", error);
      this._status = "disconnected";
      this._setupComplete = false;
      return false;
    }
  }

  private onOpen(event: Event) {
    console.log("✅ Azure OpenAI Realtime WebSocket 連線成功");
    this._status = "connected";
    this.emit("open");
    
    // 發送初始配置
    this.sendSessionUpdate();
  }

  private onMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      debugLog.azureRealtime('收到訊息:', data.type || 'unknown');
      
      this.processMessage(data);
    } catch (error) {
      console.error('❌ Azure OpenAI 訊息解析錯誤:', error);
    }
  }

  private onError(event: Event) {
    console.error("❌ Azure OpenAI Realtime WebSocket 錯誤:", event);
    this.emit("error", event as ErrorEvent);
    
    if (this._status === "connecting") {
      this._status = "disconnected";
      this._setupComplete = false;
    }
  }

  private onClose(event: CloseEvent) {
    console.log(`🔌 [Azure Realtime] WebSocket 斷線:`, {
      code: event.code,
      reason: event.reason || '未知原因',
      wasClean: event.wasClean,
      currentStatus: this._status,
      setupComplete: this._setupComplete
    });
    
    this._status = "disconnected";
    this._setupComplete = false;
    this.sessionId = null;
    this.emit("close", event);
  }

  private processMessage(data: any) {
    const messageType = data.type;
    debugLog.azureRealtime('處理訊息:', { type: messageType, hasData: !!data, hasFields: Object.keys(data) });
    
    switch (messageType) {
      case 'session.created':
        console.log('✅ Azure OpenAI Session 建立:', data.session?.id);
        this.sessionId = data.session?.id || null;
        this.emit("session_created", { id: this.sessionId || '' });
        break;
        
      case 'session.updated':
        console.log('✅ Azure OpenAI Session 配置更新');
        this._setupComplete = true;
        this.emit("session_updated");
        this.emit("setupcomplete");
        break;
        
      case 'response.audio.delta':
        // 處理音頻數據
        debugLog.audioProcessing('收到音頻 delta:', { hasDelta: !!data.delta, deltaLength: data.delta?.length });
        if (data.delta) {
          try {
            // 將 base64 音頻轉換為 ArrayBuffer
            const audioData = AudioUtils.base64ToArrayBuffer(data.delta);
            debugLog.audioProcessing('音頻數據轉換成功:', { arrayBufferSize: audioData.byteLength });
            this.emit("audio", audioData);
            debugLog.audioProcessing('已發射音頻事件');
          } catch (error) {
            console.error('❌ 音頻數據處理錯誤:', error);
          }
        }
        break;
        
      case 'response.text.delta':
        // 處理文字回應
        if (data.delta) {
          this.emit("content", { 
            modelTurn: { 
              parts: [{ text: data.delta }] 
            } 
          });
        }
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        // 輸入轉錄完成
        if (data.transcript) {
          debugLog.transcription('用戶輸入轉錄:', data.transcript);
          this.emit("input_transcription", { 
            text: data.transcript, 
            isFinal: true 
          });
        }
        break;

      case 'conversation.item.input_audio_transcription.failed':
        // 輸入轉錄失敗
        console.warn('⚠️ 用戶輸入轉錄失敗:', data.error);
        break;
        
      case 'response.audio_transcript.delta':
        // 輸出轉錄進行中
        if (data.delta) {
          debugLog.transcription('AI 回應轉錄 delta:', data.delta);
          this.emit("output_transcription", { 
            text: data.delta, 
            isFinal: false 
          });
        }
        break;

      case 'response.audio_transcript.done':
        // 輸出轉錄完成
        if (data.transcript) {
          debugLog.transcription('AI 回應轉錄完成:', data.transcript);
          this.emit("output_transcription", { 
            text: data.transcript, 
            isFinal: true 
          });
        }
        break;
        
      case 'response.done':
        console.log('✅ Azure OpenAI 回應完成');
        this._isResponseActive = false;  // 標記回應結束
        this.emit("turncomplete");
        break;

      // 處理中斷相關事件
      case 'input_audio_buffer.speech_started':
        console.log('🎤 [Azure] 檢測到用戶開始說話 - 準備中斷回應');
        this.emit("speech_started");
        break;

      case 'response.cancelled':
        console.log('⏹️ [Azure] 回應已被中斷取消');
        this._isResponseActive = false;  // 標記回應結束
        this.emit("interrupted");
        break;

      case 'output_audio_buffer.cleared':
        console.log('🔇 [Azure] 音頻輸出緩衝區已清空');
        this.emit("audio_cleared");
        break;

      case 'error':
        console.error('❌ Azure OpenAI API 錯誤:', data.error);
        this.emit("error", new ErrorEvent('api-error', {
          message: data.error?.message || '未知錯誤'
        }));
        break;
        
      default:
        console.log('📨 未處理的 Azure OpenAI 訊息類型:', messageType);
    }
  }

  private sendSessionUpdate() {
    const vadConfig = this.getVADConfig();
    const sessionConfig = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: this.config.systemPrompt || "你是一個有用的語音助手。請務必使用繁體中文（Traditional Chinese）回應，避免使用簡體中文。",
        voice: "sage",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1",
          language: "zh"
        },
        // 根據 VAD 設定動態配置
        turn_detection: vadConfig,
        temperature: 0.6,
        max_response_output_tokens: 4096
      }
    };

    console.log('📋 [Azure Realtime] Session instructions:', this.config.systemPrompt ? '使用動態 prompt' : '使用預設 prompt');
    console.log('🎤 [Azure Realtime] VAD Config 發送到 API:', JSON.stringify(vadConfig, null, 2));
    this.sendMessage(sessionConfig);
    const vadSettings = this.config.vadSettings || { enabled: true, sensitivity: 0.5, silenceDuration: 200 };
    const vadStatus = vadSettings.enabled
      ? `VAD 開啟 (靈敏度: ${vadSettings.sensitivity}, 靜音: ${vadSettings.silenceDuration}ms)`
      : 'VAD 關閉';
    debugLog.info(`Azure OpenAI 已發送 session 配置 (${vadStatus})`);
  }

  private sendMessage(message: any) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ Azure OpenAI WebSocket 未連線，無法發送訊息');
    }
  }

  // 發送實時音頻數據
  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    if (!this.isReady) {
      console.warn('⚠️ Azure OpenAI Session 未準備完成，跳過 realtime input');
      return;
    }
    
    chunks.forEach(chunk => {
      if (chunk.mimeType.includes("audio")) {
        const audioMessage = {
          type: "input_audio_buffer.append",
          audio: chunk.data
        };
        
        this.sendMessage(audioMessage);
      }
    });
  }

  // 提交音頻並創建回應
  commitAndCreateResponse() {
    if (!this.isReady) {
      console.warn('⚠️ Azure OpenAI Session 未準備完成');
      return;
    }

    // 提交音頻
    this.sendMessage({
      type: "input_audio_buffer.commit"
    });

    // 創建回應
    this.sendMessage({
      type: "response.create",
      response: {
        modalities: ["text", "audio"]
      }
    });

    this._isResponseActive = true;  // 標記回應開始
    console.log('📤 Azure OpenAI 已提交音頻並請求回應');
  }

  // 取消當前回應 - 用於插話中斷
  cancelCurrentResponse() {
    if (!this.isReady) {
      console.warn('⚠️ Azure OpenAI Session 未準備完成，無法取消回應');
      return;
    }

    // 檢查是否有正在進行的回應
    if (!this._isResponseActive) {
      console.log('ℹ️ [Azure] 沒有正在進行的回應，跳過取消操作');
      return;
    }

    this.sendMessage({
      type: "response.cancel"
    });

    console.log('🛑 Azure OpenAI 已發送取消當前回應指令');
  }

  // 發送文字訊息
  sendTextMessage(text: string) {
    if (!this.isReady) {
      console.warn('⚠️ Azure OpenAI Session 未準備完成');
      return;
    }
    
    // 創建對話項目
    const textMessage = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: text
          }
        ]
      }
    };
    
    this.sendMessage(textMessage);
    
    // 創建回應
    this.sendMessage({
      type: "response.create",
      response: {
        modalities: ["text", "audio"]
      }
    });

    this._isResponseActive = true;  // 標記回應開始
    console.log('📤 Azure OpenAI 已發送文字訊息:', text.substring(0, 50) + '...');
  }

  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this._status = "disconnected";
    this._setupComplete = false;
    this.sessionId = null;
    this._isResponseActive = false;  // 重置回應狀態
    
    console.log('🔌 Azure OpenAI Realtime API 已斷線');
    return true;
  }

}