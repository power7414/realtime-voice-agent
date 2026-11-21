import { ChatRoom, Message } from '../types/chat';

const CHAT_ROOMS_KEY = 'card6_chat_rooms_v1';
const MESSAGES_PREFIX = 'card6_messages_v1_';

/**
 * SimpleStorage - 輕量對話紀錄儲存庫
 * 
 * 使用安全的 localStorage 機制，全面替換原本過度設計的 1500 行 IndexedDB 模組。
 * 效能更高、0 延遲，支援完全同步與測試隔離。
 */
export const simpleStorage = {
  /**
   * 取得所有聊天室列表
   */
  getChatRooms(): ChatRoom[] {
    try {
      const data = localStorage.getItem(CHAT_ROOMS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get chat rooms from storage:', error);
      return [];
    }
  },

  /**
   * 儲存聊天室列表
   */
  saveChatRooms(chatRooms: ChatRoom[]): void {
    try {
      localStorage.setItem(CHAT_ROOMS_KEY, JSON.stringify(chatRooms));
    } catch (error) {
      console.error('Failed to save chat rooms to storage:', error);
    }
  },

  /**
   * 取得特定聊天室的訊息列表
   */
  getMessages(chatRoomId: string): Message[] {
    try {
      const data = localStorage.getItem(`${MESSAGES_PREFIX}${chatRoomId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Failed to get messages for room ${chatRoomId}:`, error);
      return [];
    }
  },

  /**
   * 儲存特定聊天室的訊息列表
   */
  saveMessages(chatRoomId: string, messages: Message[]): void {
    try {
      localStorage.setItem(`${MESSAGES_PREFIX}${chatRoomId}`, JSON.stringify(messages));
    } catch (error) {
      console.error(`Failed to save messages for room ${chatRoomId}:`, error);
    }
  },

  /**
   * 刪除特定聊天室的訊息紀錄
   */
  deleteMessages(chatRoomId: string): void {
    try {
      localStorage.removeItem(`${MESSAGES_PREFIX}${chatRoomId}`);
    } catch (error) {
      console.error(`Failed to delete messages for room ${chatRoomId}:`, error);
    }
  },

  /**
   * 清除所有儲存數據 (測試或重置用)
   */
  clearAll(): void {
    try {
      localStorage.removeItem(CHAT_ROOMS_KEY);
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(MESSAGES_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }
};
