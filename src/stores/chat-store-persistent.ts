import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ChatRoom, Message } from '../types/chat';
import { simpleStorage } from '../storage/simple-storage';

interface ChatState {
  chatRooms: ChatRoom[];
  activeChatRoom: string | null;
  currentTranscript: string;
  isRecording: boolean;
  
  isLoading: boolean;
  isInitialized: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;
  error: string | null;
  
  initialize: () => Promise<void>;
  addChatRoom: (chatRoom: ChatRoom) => Promise<void>;
  setActiveChatRoom: (chatRoomId: string) => Promise<void>;
  addMessage: (chatRoomId: string, message: Message) => Promise<void>;
  addMessagesToChatRoom: (chatRoomId: string, messages: Message[]) => Promise<void>;
  updateMessage: (chatRoomId: string, messageId: string, updater: (message: Message) => Message) => Promise<void>;
  updateTranscript: (transcript: string) => void;
  setRecording: (recording: boolean) => void;
  deleteChatRoom: (chatRoomId: string) => Promise<void>;
  renameChatRoom: (chatRoomId: string, newName: string) => Promise<void>;
  clearChatRoomMessages: (chatRoomId: string) => Promise<void>;
  clearTranscript: () => void;
  clearError: () => void;
  
  syncFromStorage: () => Promise<void>;
  syncToStorage: () => Promise<void>;
  refreshChatRoom: (chatRoomId: string) => Promise<void>;
}

export const usePersistentChatStore = create<ChatState>()(
  subscribeWithSelector((set, get) => ({
    chatRooms: [],
    activeChatRoom: null,
    currentTranscript: '',
    isRecording: false,
    isLoading: false,
    isInitialized: false,
    lastSyncedAt: null,
    syncError: null,
    error: null,

    initialize: async () => {
      if (get().isInitialized) return;
      set({ isLoading: true });

      try {
        const chatRooms = simpleStorage.getChatRooms();
        const activeRoom = chatRooms.find((r) => r.isActive)?.id || (chatRooms[0]?.id ?? null);

        set({
          chatRooms,
          activeChatRoom: activeRoom,
          isInitialized: true,
          isLoading: false,
          lastSyncedAt: new Date()
        });
      } catch (err: any) {
        set({ isLoading: false, isInitialized: true, syncError: err.message });
      }
    },

    addChatRoom: async (chatRoom) => {
      set((state) => {
        const newRooms = [chatRoom, ...state.chatRooms];
        simpleStorage.saveChatRooms(newRooms);
        return { chatRooms: newRooms, activeChatRoom: chatRoom.id, lastSyncedAt: new Date() };
      });
    },

    setActiveChatRoom: async (chatRoomId) => {
      set((state) => {
        const updatedRooms = state.chatRooms.map((room) => ({
          ...room,
          isActive: room.id === chatRoomId
        }));
        simpleStorage.saveChatRooms(updatedRooms);
        return { activeChatRoom: chatRoomId, chatRooms: updatedRooms };
      });
    },

    addMessage: async (chatRoomId, message) => {
      const roomMessages = simpleStorage.getMessages(chatRoomId);
      const updatedMessages = [...roomMessages, message];
      simpleStorage.saveMessages(chatRoomId, updatedMessages);

      set((state) => ({
        chatRooms: state.chatRooms.map((room) =>
          room.id === chatRoomId
            ? { ...room, messages: updatedMessages, lastMessageAt: new Date() }
            : room
        ),
        lastSyncedAt: new Date()
      }));
    },

    addMessagesToChatRoom: async (chatRoomId, messages) => {
      const roomMessages = simpleStorage.getMessages(chatRoomId);
      const updatedMessages = [...roomMessages, ...messages];
      simpleStorage.saveMessages(chatRoomId, updatedMessages);

      set((state) => ({
        chatRooms: state.chatRooms.map((room) =>
          room.id === chatRoomId
            ? { ...room, messages: updatedMessages, lastMessageAt: new Date() }
            : room
        ),
        lastSyncedAt: new Date()
      }));
    },

    updateMessage: async (chatRoomId, messageId, updater) => {
      const roomMessages = simpleStorage.getMessages(chatRoomId);
      const updatedMessages = roomMessages.map((msg) =>
        msg.id === messageId ? updater(msg) : msg
      );
      simpleStorage.saveMessages(chatRoomId, updatedMessages);

      set((state) => ({
        chatRooms: state.chatRooms.map((room) =>
          room.id === chatRoomId ? { ...room, messages: updatedMessages } : room
        )
      }));
    },

    updateTranscript: (transcript) => set({ currentTranscript: transcript }),
    setRecording: (recording) => set({ isRecording: recording }),
    clearTranscript: () => set({ currentTranscript: '' }),
    clearError: () => set({ error: null, syncError: null }),

    deleteChatRoom: async (chatRoomId) => {
      simpleStorage.deleteMessages(chatRoomId);
      set((state) => {
        const remainingRooms = state.chatRooms.filter((room) => room.id !== chatRoomId);
        const nextActive = state.activeChatRoom === chatRoomId ? (remainingRooms[0]?.id ?? null) : state.activeChatRoom;
        
        // 更新聊天室的 isActive 狀態
        const updatedRooms = remainingRooms.map((room) => ({
          ...room,
          isActive: room.id === nextActive
        }));

        simpleStorage.saveChatRooms(updatedRooms);
        return {
          chatRooms: updatedRooms,
          activeChatRoom: nextActive
        };
      });
    },

    renameChatRoom: async (chatRoomId, newName) => {
      set((state) => {
        const updatedRooms = state.chatRooms.map((room) =>
          room.id === chatRoomId ? { ...room, name: newName } : room
        );
        simpleStorage.saveChatRooms(updatedRooms);
        return { chatRooms: updatedRooms };
      });
    },

    clearChatRoomMessages: async (chatRoomId) => {
      simpleStorage.deleteMessages(chatRoomId);
      set((state) => {
        const updatedRooms = state.chatRooms.map((room) =>
          room.id === chatRoomId ? { ...room, messages: [], lastMessageAt: new Date() } : room
        );
        simpleStorage.saveChatRooms(updatedRooms);
        return { chatRooms: updatedRooms, lastSyncedAt: new Date() };
      });
    },

    syncFromStorage: async () => {
      const chatRooms = simpleStorage.getChatRooms();
      set({ chatRooms, lastSyncedAt: new Date() });
    },

    syncToStorage: async () => {
      simpleStorage.saveChatRooms(get().chatRooms);
      set({ lastSyncedAt: new Date() });
    },

    refreshChatRoom: async (chatRoomId) => {
      const messages = simpleStorage.getMessages(chatRoomId);
      set((state) => ({
        chatRooms: state.chatRooms.map((room) =>
          room.id === chatRoomId ? { ...room, messages } : room
        )
      }));
    }
  }))
);