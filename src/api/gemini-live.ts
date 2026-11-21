/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Content,
  GoogleGenAI,
  LiveCallbacks,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  Part,
  Session,
} from "@google/genai";

import { EventEmitter } from "eventemitter3";
import { difference } from "lodash";
import { LiveClientOptions, StreamingLog } from "../types";
import { AudioUtils } from "../audio/utils";

/**
 * Event types that can be emitted by the MultimodalLiveClient.
 * Each event corresponds to a specific message from GenAI or client state change.
 */
export interface LiveClientEventTypes {
  // Emitted when audio data is received
  audio: (data: ArrayBuffer) => void;
  // Emitted when the connection closes
  close: (event: CloseEvent) => void;
  // Emitted when content is received from the server
  content: (data: LiveServerContent) => void;
  // Emitted when an error occurs
  error: (error: ErrorEvent) => void;
  // Emitted when the server interrupts the current generation
  interrupted: () => void;
  // Emitted for logging events
  log: (log: StreamingLog) => void;
  // Emitted when the connection opens
  open: () => void;
  // Emitted when the initial setup is complete
  setupcomplete: () => void;
  // Emitted when the current turn is complete
  turncomplete: () => void;
  // Emitted when input transcription is received (user speech)
  input_transcription: (transcription: { text: string; isFinal?: boolean }) => void;
  // Emitted when output transcription is received (AI speech)
  output_transcription: (transcription: { text: string; isFinal?: boolean }) => void;
}

/**
 * A event-emitting class that manages the connection to the websocket and emits
 * events to the rest of the application.
 * If you dont want to use react you can still use this.
 */
export class GenAILiveClient extends EventEmitter<LiveClientEventTypes> {
  protected client: GoogleGenAI;

  private _status: "connected" | "disconnected" | "connecting" | "reconnecting" = "disconnected";
  private _setupComplete: boolean = false;
  
  public get status() {
    return this._status;
  }
  
  public get isReady() {
    return this._status === "connected" && this._setupComplete;
  }

  private _session: Session | null = null;
  public get session() {
    return this._session;
  }

  private _model: string | null = null;
  public get model() {
    return this._model;
  }

  protected config: LiveConnectConfig | null = null;

  // Session management
  private sessionStartTime: number | null = null;
  private sessionTimeoutId: NodeJS.Timeout | null = null;

  // Context window management
  private contextTokenCount = 0;
  private maxContextTokens = 32000; // Default for most models
  private nativeAudioModels = ["gemini-2.5-flash-native-audio-preview-09-2025"];
  private conversationHistory: Part[] = [];

  public getConfig() {
    return { ...this.config };
  }

  constructor(options: LiveClientOptions) {
    super();
    this.client = new GoogleGenAI(options);
    this.send = this.send.bind(this);
    this.onopen = this.onopen.bind(this);
    this.onerror = this.onerror.bind(this);
    this.onclose = this.onclose.bind(this);
    this.onmessage = this.onmessage.bind(this);
  }

  protected log(type: string, message: StreamingLog["message"]) {
    const log: StreamingLog = {
      date: new Date(),
      type,
      message,
    };
    
    // 簡化日誌 - 只在開發環境且為重要事件時emit
    if (process.env.NODE_ENV === 'development') {
      const importantTypes = ['client.open', 'server.error', 'session.timeout', 'server.goaway'];
      if (importantTypes.some(t => type.includes(t))) {
        this.emit("log", log);
      }
    }
  }

  private getSessionTimeout(): number {
    // Check if config includes video (image) processing
    const hasVideo = this.config?.responseModalities?.some((modality: any) => 
      modality.toString().toLowerCase().includes('video') || 
      modality.toString().toLowerCase().includes('image')
    ) || false;
    // Audio sessions: 15 minutes, Audio+Video: 2 minutes
    return hasVideo ? 2 * 60 * 1000 : 15 * 60 * 1000;
  }

  private setupSessionTimeout() {
    this.clearSessionTimeouts();

    const timeout = this.getSessionTimeout();
    this.sessionStartTime = Date.now();

    // Set timeout timer
    this.sessionTimeoutId = setTimeout(() => {
      this.log("session.timeout", "Session timeout reached");
      this.handleSessionTimeout();
    }, timeout);
  }

  private clearSessionTimeouts() {
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = null;
    }
  }

  private handleSessionTimeout() {
    this.log("session.timeout", "Session timed out");
    this.disconnect();
  }


  async connect(model: string, config: LiveConnectConfig): Promise<boolean> {
    console.log('🆕 開始新 session');

    if (this._status === "connected" || this._status === "connecting") {
      return false;
    }

    this._status = "connecting";
    this._setupComplete = false;

    // Add context window compression
    const enhancedConfig = {
      ...config,
      contextWindowCompression: { slidingWindow: {} }
    };

    this.config = enhancedConfig;
    this._model = model;
    
    // Set context window size based on model
    this.maxContextTokens = this.nativeAudioModels.includes(model) ? 128000 : 32000;
    this.contextTokenCount = 0;
    this.conversationHistory = [];

    const callbacks: LiveCallbacks = {
      onopen: this.onopen,
      onmessage: this.onmessage,
      onerror: this.onerror,
      onclose: this.onclose,
    };

    try {
      // Attempting to connect with Live API - should be available in @google/genai 1.15.0+
      this._session = await this.client.live.connect({
        model,
        config: enhancedConfig,
        callbacks,
      });

      console.log('✅ Live API connection established successfully');
      
      // Set status and emit events for hooks to update
      this._status = "connected";
      this._setupComplete = true;
      this.setupSessionTimeout();
      
      // Emit setupcomplete event so use-live-api hook can update ready state
      console.log("🎯 [genai-live-client] 觸發 'setupcomplete' 事件");
      this.emit("setupcomplete");
      
      console.log('✅ Live API 連接完成，可以開始使用');
      return true;
    } catch (e) {
      console.error("Error connecting to GenAI Live:", e);
      this._status = "disconnected";
      this._setupComplete = false;
      return false;
    }
  }

  public disconnect() {
    this.clearSessionTimeouts();
    
    if (!this.session) {
      return false;
    }
    this.session?.close();
    this._session = null;
    this._status = "disconnected";
    this._setupComplete = false;
    this.sessionStartTime = null;

    this.log("client.close", `Disconnected`);
    return true;
  }

  protected onopen() {
    console.log("✅ Live API WebSocket connection opened");
    this.log("client.open", "Connected");
    console.log("🎯 [genai-live-client] 觸發 'open' 事件");
    this.emit("open");
  }

  protected onerror(e: ErrorEvent) {
    console.log("Live API WebSocket error:", e);
    this.log("server.error", e.message);
    this.emit("error", e);
    
    // If error occurs during connection, mark as disconnected
    if (this._status === "connecting") {
      this._status = "disconnected";
      this._setupComplete = false;
    }
  }

  protected onclose(e: CloseEvent) {
    console.log('🔥🔥🔥 [genai-live-client] WebSocket 被斷開:', {
      code: e.code,
      reason: e.reason,
      wasClean: e.wasClean,
      type: e.type
    });
    this.log(
      `server.close`,
      `disconnected ${e.reason ? `with reason: ${e.reason}` : ``}`
    );
    this.emit("close", e);
  }

  protected async onmessage(message: LiveServerMessage) {
    // 簡化日誌 - 只在開發環境輸出重要訊息類型，避免過多輸出
    if (process.env.NODE_ENV === 'development') {
      const messageType = Object.keys(message)[0];
      // 只記錄重要的訊息類型，跳過頻繁的音頻和即時輸入訊息
      if (!['realtimeInput', 'serverContent'].includes(messageType)) {
        console.log(`📨 Live API: ${messageType}`);
      }
    }
    
    if (message.setupComplete) {
      this.log("server.send", "setupComplete");
      console.log('✅ 收到 setupComplete 訊息（可選）');
      this.emit("setupcomplete");
      return;
    }

    // this json also might be `contentUpdate { interrupted: true }`
    // or contentUpdate { end_of_turn: true }
    if (message.serverContent) {
      const { serverContent } = message;
      if ("interrupted" in serverContent) {
        this.log("server.content", "interrupted");
        this.emit("interrupted");
        return;
      }
      if ("turnComplete" in serverContent) {
        this.log("server.content", "turnComplete");
        this.emit("turncomplete");
      }

      if ("modelTurn" in serverContent) {
        let parts: Part[] = serverContent.modelTurn?.parts || [];

        // when its audio that is returned for modelTurn
        const audioParts = parts.filter(
          (p) => p.inlineData && p.inlineData.mimeType?.startsWith("audio/pcm")
        );
        const base64s = audioParts.map((p) => p.inlineData?.data);

        // strip the audio parts out of the modelTurn
        const otherParts = difference(parts, audioParts);
        // console.log("otherParts", otherParts);

        base64s.forEach((b64) => {
          if (b64) {
            const data = AudioUtils.base64ToArrayBuffer(b64);
            this.emit("audio", data);
            this.log(`server.audio`, `buffer (${data.byteLength})`);
          }
        });
        if (!otherParts.length) {
          return;
        }

        parts = otherParts;

        const content: { modelTurn: Content } = { modelTurn: { parts } };
        
        // Track AI response tokens
        const tokenCount = this.estimateTokenCount(parts);
        this.contextTokenCount += tokenCount;
        this.conversationHistory.push(...parts);
        
        this.emit("content", content);
        this.log(`server.content`, `Received content with ${tokenCount} tokens, context usage: ${this.getContextWindowUsage()}%`);
      }

      // Handle input transcription (user speech)
      if ("inputTranscription" in serverContent) {
        const transcription = {
          text: serverContent.inputTranscription?.text || "",
          isFinal: (serverContent.inputTranscription as any)?.isFinal || false
        };
        this.emit("input_transcription", transcription);
        console.log("🎤🔥 [GenAI Live Client] 發送 input_transcription 事件:", transcription);
        this.log("server.input_transcription", `Input transcription: ${transcription.text} (final: ${transcription.isFinal})`);
      }

      // Handle output transcription (AI speech)
      if ("outputTranscription" in serverContent) {
        const transcription = {
          text: serverContent.outputTranscription?.text || "",
          isFinal: (serverContent.outputTranscription as any)?.isFinal || false
        };
        this.emit("output_transcription", transcription);
        this.log("server.output_transcription", `Output transcription: ${transcription.text} (final: ${transcription.isFinal})`);
      }
    } else {
      console.log("received unmatched message", message);
    }
  }

  /**
   * send realtimeInput, this is base64 chunks of "audio/pcm" and/or "image/jpg"
   */
  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    let hasAudio = false;
    let hasVideo = false;
    for (const ch of chunks) {
      try {
        this.session!.sendRealtimeInput({ media: ch });
        if (ch.mimeType.includes("audio")) {
          hasAudio = true;
        }
        if (ch.mimeType.includes("image")) {
          hasVideo = true;
        }
        if (hasAudio && hasVideo) {
          break;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('WebSocket') || errorMessage.includes('CLOSED')) {
          console.warn('⚠️ WebSocket closed, stopping realtime input');
          return;
        } else {
          console.error('❌ Error sending realtime input:', error);
          throw error;
        }
      }
    }
    const message =
      hasAudio && hasVideo
        ? "audio + video"
        : hasAudio
        ? "audio"
        : hasVideo
        ? "video"
        : "unknown";
    this.log(`client.realtimeInput`, message);
  }

  /**
   * send normal content parts such as { text }
   */
  send(parts: Part | Part[], turnComplete: boolean = true) {
    const partsArray = Array.isArray(parts) ? parts : [parts];
    
    console.log('🔥🔥🔥 [genai-live-client] send 被呼叫:', { parts, turnComplete, hasSession: !!this.session });
    
    // Track token usage
    const tokenCount = this.estimateTokenCount(partsArray);
    this.contextTokenCount += tokenCount;
    this.conversationHistory.push(...partsArray);
    
    // Check if context needs compression
    if (this.shouldCompressContext()) {
      this.compressContext();
    }
    
    if (this.session) {
      console.log('📤 [genai-live-client] 發送訊息到 Live API session');
      this.session.sendClientContent({ turns: parts, turnComplete });
    } else {
      console.error('❌ [genai-live-client] session 不存在，無法發送訊息');
    }
    
    this.log(`client.send`, {
      turns: partsArray,
      turnComplete
    });
  }

  /**
   * Estimate token count for content (rough approximation)
   */
  private estimateTokenCount(parts: Part | Part[]): number {
    const partsArray = Array.isArray(parts) ? parts : [parts];
    let tokenCount = 0;
    
    for (const part of partsArray) {
      if (part.text) {
        // Rough estimation: 1 token ≈ 4 characters for English text
        tokenCount += Math.ceil(part.text.length / 4);
      } else if (part.inlineData) {
        // Audio/image data tokens are more complex to estimate
        // For audio PCM: roughly 1 token per 100ms at 16kHz
        // For images: varies by size, roughly 85-340 tokens per image
        if (part.inlineData.mimeType?.startsWith("audio/")) {
          tokenCount += 50; // Conservative estimate for audio chunk
        } else if (part.inlineData.mimeType?.startsWith("image/")) {
          tokenCount += 200; // Conservative estimate for image
        }
      }
    }
    
    return tokenCount;
  }

  /**
   * Check if context window needs compression
   */
  private shouldCompressContext(): boolean {
    return this.contextTokenCount > (this.maxContextTokens * 0.8); // Compress at 80% capacity
  }

  /**
   * Compress conversation history by removing older messages
   */
  private compressContext() {
    if (this.conversationHistory.length <= 2) {
      return; // Keep at least system message and last user message
    }

    // Remove oldest messages until we're under 60% of max tokens
    const targetTokens = this.maxContextTokens * 0.6;
    let removedTokens = 0;
    let removedCount = 0;

    // Keep the first message (usually system) and remove from index 1
    for (let i = 1; i < this.conversationHistory.length - 1; i++) {
      const tokens = this.estimateTokenCount(this.conversationHistory[i]);
      removedTokens += tokens;
      removedCount++;
      
      if (this.contextTokenCount - removedTokens <= targetTokens) {
        break;
      }
    }

    if (removedCount > 0) {
      this.conversationHistory.splice(1, removedCount);
      this.contextTokenCount -= removedTokens;
      this.log("context.compress", `Removed ${removedCount} messages, ${removedTokens} tokens`);
    }
  }

  /**
   * Get current context window usage
   */
  getContextWindowUsage(): { current: number; max: number; percentage: number } {
    return {
      current: this.contextTokenCount,
      max: this.maxContextTokens,
      percentage: (this.contextTokenCount / this.maxContextTokens) * 100
    };
  }
}
