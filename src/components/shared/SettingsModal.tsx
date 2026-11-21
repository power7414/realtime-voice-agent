import { useState, useCallback, useEffect, useMemo } from 'react';
import { ConversationMode } from '../../types/chat';
import './settings-modal.scss';

// Tone Persona Options
export const TONE_OPTIONS = [
  { value: 'lively', label: 'Lively', systemPrompt: 'You are lively, engaging, witty, and cheerful.' },
  { value: 'calm', label: 'Calm', systemPrompt: 'Please maintain a calm, collected, and reassuring tone.' },
  { value: 'passionate', label: 'Passionate', systemPrompt: 'Respond with high enthusiasm, warmth, and energy.' },
  { value: 'relaxed', label: 'Casual', systemPrompt: 'Respond in a relaxed, friendly, and conversational tone.' },
  { value: 'impatient', label: 'Blunt', systemPrompt: 'Be succinct, direct, and concise with minimal pleasantries.' }
] as const;

// Voice Timbre Options
export const VOICE_OPTIONS = [
  { value: 'Erinome', label: 'Erinome', description: 'Energetic & Dynamic' },
  { value: 'Despina', label: 'Despina', description: 'Clear & Natural' },
  { value: 'Aoede', label: 'Aoede', description: 'Gentle & Melodic' },
  { value: 'Laomedeia', label: 'Laomedeia', description: 'Warm & Friendly' },
  { value: 'Leda', label: 'Leda', description: 'Calm & Composed' },
  { value: 'Sulafat', label: 'Sulafat', description: 'Professional & Authoritative' },
  { value: 'Zephyr', label: 'Zephyr', description: 'Crisp & Bright' },
  { value: 'Charon', label: 'Charon', description: 'Deep & Resonant' }
] as const;

export type ToneValue = typeof TONE_OPTIONS[number]['value'];
export type VoiceValue = typeof VOICE_OPTIONS[number]['value'];

// LLM Model Options (for STT+TTS mode)
export const LLM_MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast responses, ideal for general conversation' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', description: 'Lightweight, ultra-low latency' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Advanced reasoning and complex instructions' }
] as const;

// TTS Model Options
export const TTS_MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash-preview-tts', label: 'Flash TTS', description: 'Low-latency voice synthesis' },
  { value: 'gemini-2.5-pro-preview-tts', label: 'Pro TTS', description: 'High-fidelity audio generation' }
] as const;

export type LlmModelValue = typeof LLM_MODEL_OPTIONS[number]['value'];
export type TtsModelValue = typeof TTS_MODEL_OPTIONS[number]['value'];

export interface SettingsData {
  tone: ToneValue;
  voice: VoiceValue;
  models: {
    llm: LlmModelValue;
    tts: TtsModelValue;
  };
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: SettingsData) => void;
  currentSettings: SettingsData;
  currentMode?: ConversationMode;
  onReset?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSettings,
  currentMode,
  onReset
}) => {
  const [tone, setTone] = useState<ToneValue>(currentSettings.tone);
  const [voice, setVoice] = useState<VoiceValue>(currentSettings.voice);
  const [llmModel, setLlmModel] = useState<LlmModelValue>(currentSettings.models.llm);
  const [ttsModel, setTtsModel] = useState<TtsModelValue>(currentSettings.models.tts);
  const [isPlayingPreview, setIsPlayingPreview] = useState<VoiceValue | null>(null);

  const activeMode = currentMode || 'live-api';
  
  const isLiveMode = activeMode === 'live-api';
  const isSTTTTSMode = activeMode === 'stt-tts';
  
  const modeConfig = useMemo(() => ({
    'live-api': {
      name: 'Gemini Live',
      description: 'Bidirectional streaming voice powered by Google Gemini Live API',
      color: '#4CAF50',
      icon: `${process.env.PUBLIC_URL}/images/mode-icons/live-api.png`
    },
    'azure-realtime': {
      name: 'OpenAI Realtime',
      description: 'Enterprise voice streaming powered by Azure OpenAI Realtime API',
      color: '#2196F3',
      icon: `${process.env.PUBLIC_URL}/images/mode-icons/openai.svg`
    },
    'stt-tts': {
      name: 'STT-TTS',
      description: 'Cascaded Speech-to-Text and Text-to-Speech mode',
      color: '#FF9800',
      icon: `${process.env.PUBLIC_URL}/images/mode-icons/stt-tts.svg`
    }
  } as const), []);
  
  const currentModeConfig = modeConfig[activeMode];
  const shouldShowVoiceSettings = isLiveMode || isSTTTTSMode;

  useEffect(() => {
    if (isOpen) {
      setTone(currentSettings.tone);
      setVoice(currentSettings.voice);
      setLlmModel(currentSettings.models.llm);
      setTtsModel(currentSettings.models.tts);
    }
  }, [isOpen, currentSettings]);

  const handleSave = useCallback(() => {
    onSave({
      tone,
      voice,
      models: {
        llm: llmModel,
        tts: ttsModel
      }
    });
    onClose();
  }, [tone, voice, llmModel, ttsModel, onSave, onClose]);

  const handleCancel = useCallback(() => {
    setTone(currentSettings.tone);
    setVoice(currentSettings.voice);
    setLlmModel(currentSettings.models.llm);
    setTtsModel(currentSettings.models.tts);
    onClose();
  }, [currentSettings, onClose]);

  const handleReset = useCallback(() => {
    if (onReset) {
      onReset();
    }
  }, [onReset]);

  const handlePlayPreview = useCallback(async (voiceValue: VoiceValue) => {
    if (isPlayingPreview === voiceValue) {
      setIsPlayingPreview(null);
      return;
    }
    
    if (isPlayingPreview && isPlayingPreview !== voiceValue) {
      return;
    }
    
    setIsPlayingPreview(voiceValue);
    
    try {
      const audio = new Audio(`${process.env.PUBLIC_URL}/voice-samples/${voiceValue}.wav`);
      audio.volume = 0.8;
      audio.preload = 'auto';
      
      const onEnded = () => {
        setIsPlayingPreview(null);
        cleanup();
      };
      
      const onError = () => {
        console.warn(`Could not load audio sample: ${voiceValue}.wav`);
        setIsPlayingPreview(null);
        cleanup();
      };
      
      const cleanup = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };
      
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      
      await audio.play();
    } catch (error) {
      console.error('Failed to play voice sample:', error);
      setIsPlayingPreview(null);
    }
  }, [isPlayingPreview]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCancel, handleSave]);

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={handleCancel}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-modal__header">
          <div className="header-content">
            <h2>System Settings</h2>
            <div className="mode-indicator">
              <span className="mode-icon">
                {currentModeConfig.icon.startsWith('/') ? (
                  <img src={currentModeConfig.icon} alt={currentModeConfig.name} />
                ) : (
                  currentModeConfig.icon
                )}
              </span>
              <div className="mode-info">
                <span className="mode-name">{currentModeConfig.name}</span>
                <span className="mode-description">{currentModeConfig.description}</span>
              </div>
            </div>
          </div>
          <button 
            className="settings-modal__close"
            onClick={handleCancel}
            aria-label="Close Settings"
          >
            ✕
          </button>
        </div>
        
        <div className="settings-modal__content">
          <div className="mode-notice" data-mode={activeMode}>
            <div className="mode-notice__content">
              <div className="mode-notice__header">
                <span className="mode-notice__icon">
                  {currentModeConfig.icon.startsWith('/') ? (
                    <img src={currentModeConfig.icon} alt={currentModeConfig.name} />
                  ) : (
                    currentModeConfig.icon
                  )}
                </span>
                <div className="mode-notice__title">
                  <strong>{currentModeConfig.name}</strong> Mode Settings
                </div>
              </div>
              <p className="mode-notice__description">
                {currentModeConfig.description}
              </p>
            </div>
          </div>

          {/* Tone Setting */}
          <div className="settings-section">
            <h3>Persona & Tone</h3>
            <p className="settings-section__description">
              Choose the AI assistant's persona tone (modifies system instructions)
            </p>
            <div className="radio-group">
              {TONE_OPTIONS.map((option) => (
                <label key={option.value} className="radio-option">
                  <input
                    type="radio"
                    name="tone"
                    value={option.value}
                    checked={tone === option.value}
                    onChange={() => setTone(option.value)}
                  />
                  <span className="radio-label">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Voice Setting */}
          {shouldShowVoiceSettings && (
          <div className="settings-section">
            <h3>Voice Timbre</h3>
            <p className="settings-section__description">
              Select AI voice timbre. Click preview to sample the voice.
            </p>
            <div className="voice-options">
              {VOICE_OPTIONS.map((option) => (
                <div key={option.value} className="voice-option">
                  <label className="voice-option__info">
                    <input
                      type="radio"
                      name="voice"
                      value={option.value}
                      checked={voice === option.value}
                      onChange={() => setVoice(option.value)}
                    />
                    <div className="voice-option__details">
                      <span className="voice-name">{option.label}</span>
                      <span className="voice-description">{option.description}</span>
                    </div>
                  </label>
                  <button
                    className={`voice-preview-btn ${isPlayingPreview === option.value ? 'playing' : ''}`}
                    onClick={() => handlePlayPreview(option.value)}
                    disabled={isPlayingPreview !== null && isPlayingPreview !== option.value}
                    aria-label={`${isPlayingPreview === option.value ? 'Stop' : 'Play'} ${option.label} sample`}
                  >
                    <span className="play-icon-circle">
                      {isPlayingPreview === option.value ? (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="6" width="4" height="12" />
                          <rect x="14" y="6" width="4" height="12" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>

        <div className="settings-modal__footer">
          <div className="footer-left">
            {onReset && (
              <button className="btn btn--outline" onClick={handleReset}>
                Reset to Default
              </button>
            )}
          </div>
          <div className="footer-right">
            <button className="btn btn--secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={handleSave}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};