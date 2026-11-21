/**
 * 對話系統與聊天室核心型別定義
 */

// 對話模式類型
export type ConversationType = 'live-api' | 'azure-realtime' | 'stt-tts';
export type ConversationMode = ConversationType;

// 聊天室資料結構
export interface ChatRoom {
  id: string;
  name: string;
  createdAt: Date;
  lastMessageAt: Date;
  messages: Message[];
  conversationType: ConversationType;
  isActive: boolean;
}

// 對話訊息資料結構
export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}