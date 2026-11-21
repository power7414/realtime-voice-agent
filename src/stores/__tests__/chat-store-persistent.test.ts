import { usePersistentChatStore } from '../chat-store-persistent';
import { simpleStorage } from '../../storage/simple-storage';
import { Message, ChatRoom } from '../../types/chat';

describe('ChatStore 與 SimpleStorage 整合測試', () => {
  beforeEach(() => {
    // 每次測試前重置 Storage 與 Store 狀態
    simpleStorage.clearAll();
  });

  it('當新增聊天室時，應該自動持久化寫入 simpleStorage', async () => {
    const mockRoom: ChatRoom = {
      id: 'test-room-101',
      name: '語音對話測試房',
      createdAt: new Date(),
      lastMessageAt: new Date(),
      messages: [],
      conversationType: 'live-api',
      isActive: true
    };

    // 呼叫 Store 新增聊天室
    await usePersistentChatStore.getState().addChatRoom(mockRoom);

    // 驗證 Storage 裡是否有這筆資料
    const savedRooms = simpleStorage.getChatRooms();
    expect(savedRooms.length).toBe(1);
    expect(savedRooms[0].id).toBe('test-room-101');
    expect(savedRooms[0].name).toBe('語音對話測試房');
  });

  it('當新增訊息時，應該自動寫入對應聊天室的 simpleStorage', async () => {
    const roomId = 'test-room-101';
    const mockMessage: Message = {
      id: 'msg-888',
      type: 'user',
      content: '測試語音自動寫入紀錄',
      timestamp: new Date()
    };

    // 呼叫 Store 新增訊息
    await usePersistentChatStore.getState().addMessage(roomId, mockMessage);

    // 直接向 Storage 查詢該聊天室的紀錄
    const savedMessages = simpleStorage.getMessages(roomId);
    expect(savedMessages.length).toBe(1);
    expect(savedMessages[0].id).toBe('msg-888');
    expect(savedMessages[0].content).toBe('測試語音自動寫入紀錄');
  });

  it('當刪除聊天室時，應該同步從 simpleStorage 中刪除聊天室與其對話訊息', async () => {
    const mockRoom: ChatRoom = {
      id: 'test-room-delete',
      name: '待刪除的聊天室',
      createdAt: new Date(),
      lastMessageAt: new Date(),
      messages: [],
      conversationType: 'live-api',
      isActive: true
    };

    // 新增聊天室與訊息
    await usePersistentChatStore.getState().addChatRoom(mockRoom);
    await usePersistentChatStore.getState().addMessage('test-room-delete', {
      id: 'msg-to-delete',
      type: 'user',
      content: '將被刪除的內容',
      timestamp: new Date()
    });

    // 刪除聊天室
    await usePersistentChatStore.getState().deleteChatRoom('test-room-delete');

    // 驗證 Storage 中聊天室清單與訊息是否已被徹底刪除
    const remainingRooms = simpleStorage.getChatRooms();
    const remainingMessages = simpleStorage.getMessages('test-room-delete');

    expect(remainingRooms.find(r => r.id === 'test-room-delete')).toBeUndefined();
    expect(remainingMessages.length).toBe(0);
  });
});
