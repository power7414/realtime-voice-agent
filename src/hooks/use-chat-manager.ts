import { useCallback, useEffect, useMemo } from 'react';
import { usePersistentChatStore } from '../stores/chat-store-persistent';
import { ChatRoom, ConversationType } from '../types/chat';

export function useChatManager() {
  const {
    chatRooms,
    activeChatRoom,
    isLoading,
    error,
    initialize,
    addChatRoom,
    setActiveChatRoom,
    addMessage,
    deleteChatRoom,
    renameChatRoom,
    clearError
  } = usePersistentChatStore();

  // Initialize the store when the hook is first used
  // Only call initialize once by using a ref to track initialization
  useEffect(() => {
    if (!isLoading && chatRooms.length === 0 && !error) {
      initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array is intentional - we only want to initialize once

  // Memoize next room number to prevent stale closures
  const nextRoomNumber = useMemo(() => chatRooms.length + 1, [chatRooms.length]);

  const createNewChatRoom = useCallback(async (conversationType: ConversationType, name?: string) => {
    const newChatRoom: ChatRoom = {
      id: `chatroom_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`, // More unique ID
      name: name || `Chat ${nextRoomNumber}`,
      messages: [],
      conversationType, // 新增：固定對話模式
      createdAt: new Date(),
      lastMessageAt: new Date(),
      isActive: true
    };
    
    try {
      await addChatRoom(newChatRoom);
      await setActiveChatRoom(newChatRoom.id);
      return newChatRoom.id;
    } catch (error) {
      console.error('Failed to create new chat room:', error);
      throw error;
    }
  }, [nextRoomNumber, addChatRoom, setActiveChatRoom]);

  const switchChatRoom = useCallback(async (chatRoomId: string) => {
    try {
      console.log('🔄 切換聊天室:', { from: activeChatRoom, to: chatRoomId });

      // 如果是切換到同一個聊天室，跳過操作
      if (activeChatRoom === chatRoomId) {
        console.log('⚠️ 已經在目標聊天室中，跳過切換');
        return;
      }

      // 切換到新聊天室
      await setActiveChatRoom(chatRoomId);
      console.log('✅ 已切換到聊天室:', chatRoomId);
      console.log('💡 提示：如果正在連線，請先斷開連線再切換聊天室');

    } catch (error) {
      console.error('Failed to switch chat room:', error);
    }
  }, [setActiveChatRoom, activeChatRoom]);

  // Memoize active chat room lookup to prevent unnecessary recalculations
  const getActiveChatRoom = useMemo(() => {
    return chatRooms.find(room => room.id === activeChatRoom);
  }, [chatRooms, activeChatRoom]);

  const deleteChatRoomWithConfirm = useCallback(async (chatRoomId: string) => {
    const chatRoom = chatRooms.find(r => r.id === chatRoomId);
    if (!chatRoom) return;

    const confirmed = window.confirm(
      `確定要刪除「${chatRoom.name}」嗎？此操作無法恢復。`
    );
    
    if (confirmed) {
      try {
        await deleteChatRoom(chatRoomId);
      } catch (error) {
        console.error('Failed to delete chat room:', error);
        alert('刪除聊天室失敗，請稍後再試。');
      }
    }
  }, [chatRooms, deleteChatRoom]);

  const renameChatRoomWithPrompt = useCallback(async (chatRoomId: string) => {
    const chatRoom = chatRooms.find(r => r.id === chatRoomId);
    if (!chatRoom) return;

    const newName = window.prompt('請輸入新的聊天室名稱：', chatRoom.name);
    if (newName && newName.trim() !== '') {
      try {
        await renameChatRoom(chatRoomId, newName.trim());
      } catch (error) {
        console.error('Failed to rename chat room:', error);
        alert('重新命名聊天室失敗，請稍後再試。');
      }
    }
  }, [chatRooms, renameChatRoom]);

  return {
    chatRooms,
    activeChatRoom,
    getActiveChatRoom: () => getActiveChatRoom, // Return as function for consistency
    isLoading,
    error,
    createNewChatRoom,
    switchChatRoom,
    addMessage,
    deleteChatRoomWithConfirm,
    renameChatRoomWithPrompt,
    clearError
  };
}