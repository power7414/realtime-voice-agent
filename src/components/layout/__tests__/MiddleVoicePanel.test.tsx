import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MiddleVoicePanel } from '../MiddleVoicePanel';
import { ChatRoom } from '../../../types/chat';

describe('MiddleVoicePanel Component Tests', () => {
  const mockChatRoom: ChatRoom = {
    id: 'room-1',
    name: 'Test Voice Room',
    createdAt: new Date(),
    lastMessageAt: new Date(),
    messages: [],
    conversationType: 'live-api',
    isActive: true
  };

  const defaultProps = {
    activeChatRoom: mockChatRoom,
    isConnected: true,
    isConnecting: false,
    isSTTMode: false,
    muted: false,
    voiceStatus: 'ai_speaking',
    aiVolume: 0.5,
    userVolume: 0,
    onMicClick: jest.fn(),
    onConnect: jest.fn(),
    onDisconnect: jest.fn()
  };

  it('renders "Select a Chat Room" prompt when no room is selected', () => {
    const { getByText } = render(<MiddleVoicePanel {...defaultProps} activeChatRoom={undefined} />);
    expect(getByText('Select a Chat Room')).not.toBeNull();
  });

  it('displays "AI Speaking" when active room has AI speaking', () => {
    const { getByText } = render(<MiddleVoicePanel {...defaultProps} voiceStatus="ai_speaking" />);
    expect(getByText('AI Speaking')).not.toBeNull();
  });

  it('displays "Listening..." when user is speaking', () => {
    const { getByText } = render(<MiddleVoicePanel {...defaultProps} voiceStatus="user_speaking" />);
    expect(getByText('Listening...')).not.toBeNull();
  });

  it('triggers onMicClick callback on mic button click', () => {
    const { getByTitle } = render(<MiddleVoicePanel {...defaultProps} />);
    const micButton = getByTitle('Mute');
    fireEvent.click(micButton);

    expect(defaultProps.onMicClick).toHaveBeenCalledTimes(1);
  });

  it('triggers onDisconnect callback on disconnect button click', () => {
    const { getByTitle } = render(<MiddleVoicePanel {...defaultProps} isConnected={true} />);
    const disconnectButton = getByTitle('End Conversation');
    fireEvent.click(disconnectButton);

    expect(defaultProps.onDisconnect).toHaveBeenCalledTimes(1);
  });
});
