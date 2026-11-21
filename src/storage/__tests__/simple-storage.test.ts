import { simpleStorage } from '../simple-storage';
import { ChatRoom, Message } from '../../types/chat';

describe('SimpleStorage 單元測試', () => {
  beforeEach(() => {
    // 每次測試前清空 Storage
    simpleStorage.clearAll();
  });

  it('應該能成功儲存與讀取聊天室列表', () => {
    const mockRooms: ChatRoom[] = [
      { id: 'room-1', name: '測試聊天室 1', createdAt: new Date(), lastMessageAt: new Date(), messages: [], conversationType: 'live-api', isActive: true },
      { id: 'room-2', name: '測試聊天室 2', createdAt: new Date(), lastMessageAt: new Date(), messages: [], conversationType: 'stt-tts', isActive: false }
    ];

    simpleStorage.saveChatRooms(mockRooms);
    const loadedRooms = simpleStorage.getChatRooms();

    expect(loadedRooms.length).toBe(2);
    expect(loadedRooms[0].name).toBe('測試聊天室 1');
  });

  it('應該能成功儲存與讀取指定聊天室的訊息', () => {
    const roomId = 'room-1';
    const mockMessages: Message[] = [
      { id: 'msg-1', type: 'user', content: 'Hello AI', timestamp: new Date() },
      { id: 'msg-2', type: 'assistant', content: 'Hello User!', timestamp: new Date() }
    ];

    simpleStorage.saveMessages(roomId, mockMessages);
    const loadedMessages = simpleStorage.getMessages(roomId);

    expect(loadedMessages.length).toBe(2);
    expect(loadedMessages[0].content).toBe('Hello AI');
    expect(loadedMessages[1].content).toBe('Hello User!');
  });

  it('應該能成功刪除聊天室對應的訊息', () => {
    const roomId = 'room-1';
    simpleStorage.saveMessages(roomId, [
      { id: 'msg-1', type: 'user', content: 'Will be deleted', timestamp: new Date() }
    ]);

    simpleStorage.deleteMessages(roomId);
    const loadedMessages = simpleStorage.getMessages(roomId);

    expect(loadedMessages.length).toBe(0);
  });
});
