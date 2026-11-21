import React, { useState } from 'react';
import { FiMessageCircle, FiMoreVertical, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { ChatRoom } from '../../types/chat';

interface ChatItemProps {
  chatRoom: ChatRoom;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: () => void;
}

export const ChatItem: React.FC<ChatItemProps> = ({
  chatRoom,
  isActive,
  onClick,
  onDelete,
  onRename
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const getModeDisplayName = (mode: string) => {
    switch (mode) {
      case 'live-api':
        return 'Gemini Live';
      case 'azure-realtime':
        return 'OpenAI Realtime';
      case 'stt-tts':
        return 'STT-TTS';
      default:
        return mode;
    }
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onRename();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete();
  };

  const lastMessage = chatRoom.messages[chatRoom.messages.length - 1];
  const preview = lastMessage?.content.slice(0, 50) || 'New Chat';

  return (
    <div className={`chat-item ${isActive ? 'active' : ''}`} onClick={onClick}>
      <div className="chat-item-icon">
        <FiMessageCircle />
      </div>
      
      <div className="chat-item-content">
        <div className="chat-item-header">
          <h3 className="chat-item-title">{chatRoom.name}</h3>
          <button 
            className="chat-item-menu-button"
            onClick={handleMenuToggle}
            aria-label="Chat room options"
          >
            <FiMoreVertical />
          </button>
          
          {showMenu && (
            <div className="chat-item-menu">
              <button onClick={handleRename}>
                <FiEdit2 />
                <span>Rename</span>
              </button>
              <button onClick={handleDelete} className="delete">
                <FiTrash2 />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
        
        <p className="chat-item-preview">{preview}</p>
        
        <div className="chat-item-meta">
          <div className="meta-info">
            <span className="message-count">{chatRoom.messages.length} messages</span>
            <span className="conversation-type">{getModeDisplayName(chatRoom.conversationType)}</span>
            <span className="last-active">
              {new Date(chatRoom.lastMessageAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};