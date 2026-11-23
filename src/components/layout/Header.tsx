import React from 'react';
import { FiMenu, FiHelpCircle, FiSettings, FiWifi, FiWifiOff } from 'react-icons/fi';
import { useUIStore } from '../../stores/ui-store';
import './layout.scss';

interface HeaderProps {
  onHelpClick?: () => void;
  onSettingsClick?: () => void;
  connectionStatus?: {
    connected: boolean;
    label: string;
  };
  activeRoom?: {
    name: string;
    mode: string;
  };
  showTimer?: boolean;
  timerValue?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onHelpClick,
  onSettingsClick,
  connectionStatus,
  activeRoom,
  showTimer,
  timerValue
}) => {
  const { toggleLeftPanel } = useUIStore();

  const getModeDisplayName = (mode: string) => {
    switch (mode) {
      case 'live-api':
        return 'Gemini Live';
      case 'azure-realtime':
        return 'Azure OpenAI Realtime';
      case 'stt-tts':
        return 'STT-TTS';
      default:
        return mode;
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button 
          className="menu-button" 
          onClick={toggleLeftPanel}
          aria-label="Toggle sidebar"
        >
          <FiMenu />
        </button>
        <h1 className="app-title">Conversational AI Platform</h1>
      </div>
      
      <div className="header-center">
        {activeRoom && (
          <div className="room-info">
            <h2 className="room-name">{activeRoom.name}</h2>
            <span className="room-mode">{getModeDisplayName(activeRoom.mode)}</span>
          </div>
        )}
        {showTimer && timerValue && (
          <div className="session-timer">
            <span className="timer-label">Duration</span>
            <span className="timer-value">{timerValue}</span>
          </div>
        )}
      </div>
      
      <div className="header-right">
        {connectionStatus && (
          <div className={`connection-status ${connectionStatus.connected ? 'connected' : 'disconnected'}`}>
            {connectionStatus.connected ? <FiWifi /> : <FiWifiOff />}
            <span>{connectionStatus.label}</span>
          </div>
        )}
        {onSettingsClick && (
          <button 
            className="icon-button" 
            onClick={onSettingsClick}
            aria-label="Settings"
          >
            <FiSettings />
            <span>Settings</span>
          </button>
        )}
        <button 
          className="icon-button" 
          onClick={onHelpClick}
          aria-label="Help"
        >
          <FiHelpCircle />
          <span>Help</span>
        </button>
      </div>
    </header>
  );
};