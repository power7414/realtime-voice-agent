import React, { useState } from 'react';
import { ChatList } from './ChatList';
import { NewChatButton } from './NewChatButton';
import { useChatManager } from '../../hooks/use-chat-manager';
import { ConversationModeSelectionModal } from '../shared/ConversationModeSelectionModal';
import { ConversationType } from '../../types/chat';
import './chat-room-sidebar.scss';

export const ChatSidebar: React.FC = () => {
  const { createNewChatRoom } = useChatManager();
  const [showModeModal, setShowModeModal] = useState(false);

  const handleNewChatClick = () => {
    setShowModeModal(true);
  };

  const handleModeSelect = async (mode: ConversationType) => {
    setShowModeModal(false);
    try {
      await createNewChatRoom(mode);
    } catch (error) {
      console.error('Failed to create new chat room:', error);
    }
  };

  const handleModalClose = () => {
    setShowModeModal(false);
  };

  return (
    <div className="chat-sidebar">
      <div className="chat-sidebar-header">
        <h2>Chat Rooms</h2>
        <NewChatButton onClick={handleNewChatClick} />
      </div>
      
      <div className="chat-sidebar-content">
        <ChatList />
      </div>

      <ConversationModeSelectionModal
        isOpen={showModeModal}
        onClose={handleModalClose}
        onModeSelect={handleModeSelect}
      />
    </div>
  );
};