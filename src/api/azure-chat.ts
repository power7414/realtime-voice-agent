/**
 * Azure OpenAI Chat Service for STT-TTS pipeline
 * 提供基於 Azure OpenAI 的 LLM 對話功能，專門用於 STT-TTS 流程
 */

import { Message } from '../types/chat';

export interface AzureOpenAIChatConfig {
  /** Azure OpenAI 端點 */
  endpoint: string;
  /** Azure OpenAI API 金鑰 */
  apiKey: string;
  /** 部署模型名稱 */
  deploymentName: string;
  /** API 版本 */
  apiVersion?: string;
  /** 溫度參數 */
  temperature?: number;
  /** 最大 tokens */
  maxTokens?: number;
  /** 是否啟用詳細日誌 */
  enableLogging?: boolean;
}

export interface ChatRequest {
  /** 用戶輸入文字 */
  userMessage: string;
  /** 對話歷史 */
  chatHistory?: Message[];
  /** 系統提示詞 */
  systemPrompt?: string;
  /** 覆蓋預設配置 */
  overrides?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface ChatResponse {
  success: boolean;
  /** AI 回應內容 */
  response: string;
  /** 請求處理時間 (ms) */
  processingTime: number;
  /** 使用的 tokens 數量 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 錯誤訊息 */
  error?: string;
}

/**
 * Azure OpenAI Chat 服務
 * 專為 STT-TTS 流程設計的對話服務
 */
export class AzureOpenAIChatService {
  private readonly config: AzureOpenAIChatConfig;
  private readonly baseUrl: string;
  private readonly enableLogging: boolean;

  constructor(config: AzureOpenAIChatConfig) {
    this.config = {
      apiVersion: '2024-12-01-preview',
      temperature: 0.2,
      maxTokens: 1000,
      enableLogging: false,
      ...config
    };
    
    this.enableLogging = this.config.enableLogging ?? false;
    
    // 構建 Azure OpenAI API URL
    this.baseUrl = `${config.endpoint}/openai/deployments/${config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`;
    
    // 驗證必需參數
    if (!config.endpoint || !config.apiKey || !config.deploymentName) {
      throw new Error('Azure OpenAI endpoint, API key, and deployment name are required');
    }

    if (this.enableLogging) {
      console.log('🤖 [AzureOpenAIChat] Service initialized:', {
        endpoint: config.endpoint,
        deployment: config.deploymentName,
        apiVersion: this.config.apiVersion,
        hasApiKey: !!config.apiKey
      });
    }
  }

  /**
   * 發送對話請求到 Azure OpenAI
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    if (this.enableLogging) {
      console.log('💬 [AzureOpenAIChat] Sending message:', {
        messageLength: request.userMessage.length,
        hasHistory: request.chatHistory && request.chatHistory.length > 0,
        historyCount: request.chatHistory?.length || 0,
        hasSystemPrompt: !!request.systemPrompt
      });
    }

    try {
      const messages = this.buildMessages(request);
      const payload = {
        messages,
        temperature: request.overrides?.temperature ?? this.config.temperature,
        max_tokens: request.overrides?.maxTokens ?? this.config.maxTokens,
        stream: false
      };

      if (this.enableLogging) {
        console.log('📤 [AzureOpenAIChat] Request payload:', {
          messageCount: messages.length,
          temperature: payload.temperature,
          maxTokens: payload.max_tokens
        });
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      const result: ChatResponse = {
        success: true,
        response: data.choices[0]?.message?.content || '',
        processingTime,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined
      };

      if (this.enableLogging) {
        console.log('✅ [AzureOpenAIChat] Response received:', {
          responseLength: result.response.length,
          processingTime: `${processingTime}ms`,
          usage: result.usage
        });
      }

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      console.error('❌ [AzureOpenAIChat] Request failed:', error);

      return {
        success: false,
        response: '',
        processingTime,
        error: errorMessage
      };
    }
  }

  /**
   * 構建 OpenAI 格式的訊息陣列
   */
  private buildMessages(request: ChatRequest) {
    const messages: Array<{ role: string; content: string }> = [];

    // 添加系統提示詞
    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt
      });
    }

    // 添加對話歷史
    if (request.chatHistory && request.chatHistory.length > 0) {
      for (const msg of request.chatHistory) {
        messages.push({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }

    // 添加當前用戶訊息
    messages.push({
      role: 'user',
      content: request.userMessage
    });

    return messages;
  }

  /**
   * 測試服務連接
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const testResponse = await this.sendMessage({
        userMessage: 'Hello, this is a connection test.',
        systemPrompt: 'You are a helpful assistant. Please respond with a brief acknowledgment.'
      });

      return {
        success: testResponse.success,
        error: testResponse.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  /**
   * 獲取服務狀態
   */
  getServiceStatus() {
    return {
      configured: !!(this.config.endpoint && this.config.apiKey && this.config.deploymentName),
      endpoint: this.config.endpoint,
      deployment: this.config.deploymentName,
      apiVersion: this.config.apiVersion
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<AzureOpenAIChatConfig>) {
    Object.assign(this.config, newConfig);
    
    if (this.enableLogging) {
      console.log('🔧 [AzureOpenAIChat] Configuration updated:', newConfig);
    }
  }
}