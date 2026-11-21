import React from 'react';
import { FiMic, FiMicOff, FiX, FiWifi, FiMessageSquare } from 'react-icons/fi';
import AudioPulse from '../audio-pulse/AudioPulse';
import { ChatRoom } from '../../types/chat';

interface MiddleVoicePanelProps {
  activeChatRoom: ChatRoom | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isSTTMode: boolean;
  muted: boolean;
  voiceStatus: string;
  aiVolume: number;
  userVolume: number;
  sttConversationStatus?: {
    isRecording?: boolean;
    isProcessingVoice?: boolean;
  };
  onMicClick: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const MiddleVoicePanel: React.FC<MiddleVoicePanelProps> = ({
  activeChatRoom,
  isConnected,
  isConnecting,
  isSTTMode,
  muted,
  voiceStatus,
  aiVolume,
  userVolume,
  sttConversationStatus,
  onMicClick,
  onConnect,
  onDisconnect
}) => {
  if (!activeChatRoom) {
    return (
      <div className="middle-panel">
        <div className="default-panel">
          <div className="default-content">
            <FiMessageSquare size={48} />
            <h3 className="default-title">Select a Chat Room</h3>
            <p className="default-subtitle">Select or create a chat room to start conversation</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'listening':
      case 'user_speaking':
        return 'listening';
      case 'speaking':
      case 'ai_speaking':
        return 'speaking';
      case 'thinking':
      case 'processing':
        return 'thinking';
      default:
        return isConnected ? 'connected' : 'disconnected';
    }
  };

  const getMicButtonStyle = () => {
    if (isSTTMode) {
      if (sttConversationStatus?.isRecording) {
        return {
          outline: '3px solid rgba(239, 68, 68, 0.6)',
          outlineOffset: '-2px',
          boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
          backgroundColor: '#ef4444',
          color: '#ffffff'
        };
      }
      return {};
    }

    if (muted || !isConnected || userVolume <= 0.05) {
      return {};
    }

    const intensity = Math.min(userVolume * 10, 1);
    const outlineWidth = Math.max(2, intensity * 8);
    const opacity = Math.max(0.3, intensity * 0.8);

    return {
      outline: `${outlineWidth}px solid rgba(59, 130, 246, ${opacity})`,
      outlineOffset: '-2px',
      boxShadow: `0 0 ${outlineWidth * 2}px rgba(59, 130, 246, ${opacity * 0.5})`,
      transition: 'all 0.1s ease-out'
    };
  };

  return (
    <div className="middle-panel voice-panel">
      <div className="voice-indicator">
        <div className={`indicator-circle ${getStatusColor(voiceStatus)}`}>
          <div className="indicator-content">
            <AudioPulse
              active={voiceStatus === 'ai_speaking'}
              volume={voiceStatus === 'ai_speaking' ? (aiVolume > 0 ? aiVolume : 0.6) : 0}
              hover={false}
            />
          </div>
        </div>
      </div>

      <div className="status-section">
        <div className="status-text">
          {isSTTMode && sttConversationStatus?.isProcessingVoice ? 'Processing...' :
           isConnecting ? 'Connecting...' :
           !isConnected ? 'Disconnected' :
           voiceStatus === 'ai_speaking' ? 'AI Speaking' :
           voiceStatus === 'user_speaking' ? 'Listening...' : 'Connected'}
        </div>

        <div className="control-buttons">
          <button
            className={`mic-button ${isConnected ? 'connected' : ''} ${
              isSTTMode ?
                (sttConversationStatus?.isRecording ? 'recording' : '') :
                (muted ? 'muted' : '')
            }`}
            onClick={onMicClick}
            disabled={!isConnected}
            title={
              isSTTMode ?
                (sttConversationStatus?.isRecording ? "Stop Recording" : "Start Recording") :
                (muted ? "Unmute" : "Mute")
            }
            style={getMicButtonStyle()}
          >
            {isSTTMode ?
              (sttConversationStatus?.isRecording ? <FiMicOff size={24} /> : <FiMic size={24} />) :
              (muted ? <FiMicOff size={24} /> : <FiMic size={24} />)
            }
          </button>
          
          <button
            className={`connect-button ${isConnected ? 'disconnect' : 'connect'}`}
            onClick={isConnected ? onDisconnect : onConnect}
            title={isConnected ? "End Conversation" : "Start Conversation"}
            disabled={false}
          >
            {isConnected ? <FiX size={20} /> : <FiWifi size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};
