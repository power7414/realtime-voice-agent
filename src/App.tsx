import React, { memo, useState, useRef, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { TranscriptPanel } from './components/layout/TranscriptPanel';
import { MiddleVoicePanel } from './components/layout/MiddleVoicePanel';
import { ChatSidebar } from './components/chat-room-sidebar/ChatSidebar';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { SettingsModal } from './components/shared/SettingsModal';
import { useChatManager } from './hooks/use-chat-manager';
import { useUIStore } from './stores/ui-store';
import { useSettings } from './stores/settings-store';
import { usePersistentChatStore } from './stores/chat-store-persistent';
import { useConversationController } from './hooks/use-conversation-controller';
import { useConversationEvents } from './hooks/use-conversation-events';
import { downloadTranscriptAsFile } from './utils/transcript-exporter';
import { logApiConfigStatus } from './config/api-config';

import './App.scss';
import './styles/app-main-layout.scss';
import './components/layout/layout.scss';

// 執行 API 配置診斷
logApiConfigStatus();

// Memoized components to prevent unnecessary re-renders
const MemoizedChatSidebar = memo(ChatSidebar);

function AppContent() {
  const { error, clearError } = useChatManager();
  const { leftPanelOpen } = useUIStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const { settings, updateSettings } = useSettings();

  // === 終極重構：使用對話控制器 Hook ===
  const controller = useConversationController();
  const {
    currentMode,
    activeConversationRoom,
    isConnected,
    isConnecting,
    isSTTMode,
    muted,
    voiceStatus,
    inputAudioLevel,
    liveClient,
    azureClient,
    sttConversation,
    handleConnect,
    handleDisconnect,
    handleMicClick
  } = controller;

  // 監聽對話事件
  useConversationEvents(liveClient, azureClient, currentMode);

  // 自動滾動到最新訊息
  useEffect(() => {
    if (transcriptRef.current && activeConversationRoom?.messages) {
      transcriptRef.current.scrollTo({
        top: transcriptRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [activeConversationRoom?.messages]);

  const { clearChatRoomMessages } = usePersistentChatStore();

  // 下載轉錄
  const handleDownloadTranscript = () => {
    if (!activeConversationRoom?.messages || activeConversationRoom.messages.length === 0) return;
    downloadTranscriptAsFile(activeConversationRoom.name, activeConversationRoom.messages);
  };

  // 清除轉錄 (正宗 Zustand 不可變狀態 Action)
  const handleClearTranscript = () => {
    if (activeConversationRoom) {
      clearChatRoomMessages(activeConversationRoom.id);
    }
  };

  if (error) {
    return (
      <div className="app-error">
        <h2>Application Error</h2>
        <p>{error}</p>
        <button onClick={clearError}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      <ErrorBoundary>
        <Header 
          onHelpClick={() => console.log('Help clicked')}
          onSettingsClick={() => setIsSettingsOpen(true)}
          connectionStatus={{
            connected: isConnected,
            label: isConnected ? 'Connected' : 'Disconnected'
          }}
          activeRoom={activeConversationRoom ? {
            name: activeConversationRoom.name,
            mode: activeConversationRoom.conversationType
          } : undefined}
        />
      </ErrorBoundary>
      
      <ErrorBoundary>
        <div className={`three-column-layout ${leftPanelOpen ? '' : 'sidebar-collapsed'}`}>
          {/* 左側面板 - 聊天室列表 (20%) */}
          <div className="left-panel">
            <MemoizedChatSidebar />
          </div>

          {/* 中間面板 - 語音控制 (40%) */}
          <MiddleVoicePanel
            activeChatRoom={activeConversationRoom}
            isConnected={isConnected}
            isConnecting={isConnecting}
            isSTTMode={isSTTMode}
            muted={muted}
            voiceStatus={voiceStatus}
            aiVolume={voiceStatus === 'ai_speaking' ? 0.6 : 0}
            userVolume={inputAudioLevel}
            sttConversationStatus={sttConversation}
            onMicClick={handleMicClick}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />

          {/* 右側面板 - 轉錄 (40%) */}
          <TranscriptPanel
            activeChatRoom={activeConversationRoom}
            transcriptRef={transcriptRef}
            isConnected={isConnected}
            isSTTMode={isSTTMode}
            sttConversationStatus={sttConversation}
            onDownloadTranscript={handleDownloadTranscript}
            onClearTranscript={handleClearTranscript}
          />
        </div>
      </ErrorBoundary>
      
      {/* 設定模態框 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={updateSettings}
        currentSettings={settings}
        currentMode={activeConversationRoom?.conversationType}
      />
    </div>
  );
}

const MemoizedAppContent = memo(AppContent);

function App() {
  return <MemoizedAppContent />;
}

export default App;