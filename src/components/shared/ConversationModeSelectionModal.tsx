/**
 * ConversationModeSelectionModal - Conversation mode selection on chat room creation
 */

import React from 'react';
import { ConversationType } from '../../types/chat';
import './ConversationModeSelectionModal.scss';

export interface ConversationModeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModeSelect: (mode: ConversationType) => void;
  disabled?: boolean;
}

interface ModeOption {
  type: ConversationType;
  title: string;
  iconSrc: string;
  colorClass: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    type: 'live-api',
    title: 'Gemini Live',
    iconSrc: `${process.env.PUBLIC_URL}/images/mode-icons/live-api.png`,
    colorClass: 'sky'
  },
  {
    type: 'azure-realtime',
    title: 'OpenAI Realtime',
    iconSrc: `${process.env.PUBLIC_URL}/images/mode-icons/openai.svg`,
    colorClass: 'sky'
  },
  {
    type: 'stt-tts',
    title: 'STT-TTS',
    iconSrc: `${process.env.PUBLIC_URL}/images/mode-icons/openai.svg`,
    colorClass: 'sky'
  }
];

export const ConversationModeSelectionModal: React.FC<ConversationModeSelectionModalProps> = ({
  isOpen,
  onClose,
  onModeSelect,
  disabled = false
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleModeSelect = (mode: ConversationType) => {
    if (!disabled) {
      onModeSelect(mode);
      onClose();
    }
  };

  return (
    <div className="conversation-mode-modal-overlay" onClick={handleOverlayClick}>
      <div className="conversation-mode-modal">
        <div className="modal-header">
          <h2 className="modal-title">Select Conversation Mode</h2>
          <button 
            className="modal-close-button"
            onClick={onClose}
            disabled={disabled}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Choose a conversation mode to create a new chat room. Each room uses a dedicated mode.
          </p>

          <div className="mode-options-grid">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.type}
                className={`mode-option-card ${option.colorClass} ${disabled ? 'disabled' : ''}`}
                onClick={() => handleModeSelect(option.type)}
                disabled={disabled}
              >
                <div className="mode-icon-container">
                  <img
                    src={option.iconSrc}
                    alt={option.title}
                    className="mode-icon-image"
                  />
                </div>

                <div className="mode-content">
                  <h3 className="mode-title">{option.title}</h3>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="cancel-button"
            onClick={onClose}
            disabled={disabled}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};