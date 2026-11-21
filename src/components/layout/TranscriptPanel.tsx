import React from 'react';
import { FiDownload, FiTrash2, FiMessageSquare } from 'react-icons/fi';
import { ChatRoom } from '../../types/chat';

interface TranscriptPanelProps {
  activeChatRoom: ChatRoom | undefined;
  transcriptRef: any;
  isConnected: boolean;
  isSTTMode: boolean;
  sttConversationStatus?: {
    isRecording?: boolean;
    isProcessingVoice?: boolean;
    isSpeaking?: boolean;
  };
  onDownloadTranscript: () => void;
  onClearTranscript: () => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  activeChatRoom,
  transcriptRef,
  isConnected,
  isSTTMode,
  sttConversationStatus,
  onDownloadTranscript,
  onClearTranscript
}) => {
  if (!activeChatRoom) {
    return (
      <div className="right-panel">
        <div className="default-panel">
          <div className="default-content">
            <FiMessageSquare size={48} />
            <h3 className="default-title">Live Transcript</h3>
            <p className="default-subtitle">Transcripts will appear here after selecting a chat room</p>
          </div>
        </div>
      </div>
    );
  }

  const messages = activeChatRoom.messages || [];

  return (
    <div className="right-panel transcript-panel">
      <div className="transcript-header">
        <div className="header-info">
          <h2>Live Transcript</h2>
          <p>Realtime Transcript - {activeChatRoom.name}</p>
        </div>
        <div className="header-actions">
          <button
            className="action-btn"
            onClick={onDownloadTranscript}
            disabled={messages.length === 0}
            title="Download Transcript"
          >
            <FiDownload size={16} />
          </button>
          
          <button
            className="action-btn"
            onClick={onClearTranscript}
            disabled={messages.length === 0}
            title="Clear Transcript"
          >
            <FiTrash2 size={16} />
          </button>
        </div>
      </div>

      <div ref={transcriptRef} className="transcript-content">
        {messages.length === 0 ? (
          <div className="empty-transcript">
            <FiMessageSquare size={48} />
            <h3 className="empty-title">No Conversation Yet</h3>
            <p className="empty-subtitle">Transcripts will appear here once the conversation starts</p>
          </div>
        ) : (
          messages.map((msg: any, index: number) => (
            <div
              key={msg.id || index}
              className={`transcript-message ${msg.type === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              <div className={`message-icon ${msg.type === 'user' ? 'user' : 'assistant'}`}>
                <img
                  src={msg.type === 'user' ? '/images/avatars/user-avatar.png' : '/images/avatars/ai-avatar.png'}
                  alt={msg.type === 'user' ? 'User Avatar' : 'AI Avatar'}
                  className="avatar-image"
                />
              </div>
              <div className="message-content">
                <div className="message-header">
                  <span className="message-sender">
                    {msg.type === 'user' ? 'User' : 'Assistant'}
                  </span>
                  <span className="message-time">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="message-text">{msg.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="transcript-status">
        <div className="status-info">
          <span>{messages.length} messages</span>
          <div className="connection-status">
            <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            <span>
              {isSTTMode ? (
                sttConversationStatus?.isRecording ? 'Recording' : 
                sttConversationStatus?.isProcessingVoice ? 'Processing' : 
                sttConversationStatus?.isSpeaking ? 'Playing' :
                isConnected ? 'Connected' : 'Disconnected'
              ) : (
                isConnected ? 'Live Connected' : 'Disconnected'
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
