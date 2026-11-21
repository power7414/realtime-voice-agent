import React from 'react';
import { FiPlus } from 'react-icons/fi';

interface NewChatButtonProps {
  onClick: () => void;
}

export const NewChatButton: React.FC<NewChatButtonProps> = ({ onClick }) => {
  return (
    <button className="new-chat-button" onClick={onClick} aria-label="Create new chat room">
      <FiPlus />
      <span>New Chat</span>
    </button>
  );
};