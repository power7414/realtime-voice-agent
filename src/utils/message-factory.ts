/**
 * 共用的訊息創建工廠函數
 * 簡化版本：直接實現，移除不必要的抽象層
 */

import { Message } from '../types/chat';

/**
 * 創建用戶訊息
 */
export const createUserMessage = (content: string, options?: Partial<Message>): Message => ({
  id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  type: 'user',
  content: content.trim(),
  timestamp: new Date(),
  ...options
});

/**
 * 創建助理訊息
 */
export const createAssistantMessage = (content: string, options?: Partial<Message>): Message => ({
  id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  type: 'assistant',
  content: content.trim(),
  timestamp: new Date(),
  ...options
});

/**
 * 創建錯誤訊息
 */
export const createErrorMessage = (error: unknown): Message =>
  createAssistantMessage(`發送失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
