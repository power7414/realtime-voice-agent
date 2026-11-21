import { useCallback, useEffect, useRef } from 'react';
import { usePersistentChatStore } from '../stores/chat-store-persistent';
import { useChatManager } from './use-chat-manager';
import { useUIStore } from '../stores/ui-store';
import { createAssistantMessage, createUserMessage } from '../utils/message-factory';
import { GenAILiveClient } from '../api/gemini-live';
import { AzureOpenAIRealtimeClient } from '../api/azure-realtime';
import { ConversationMode } from '../types/chat';

/**
 * 專門處理 Realtime API 事件的 Hook
 * 這個 Hook 應該只在 App 層級使用一次，避免重複的事件監聽器
 *
 * @param geminiClient - Gemini Live API 客戶端實例
 * @param azureClient - Azure Realtime API 客戶端實例
 * @param currentMode - 當前對話模式
 */
export function useConversationEvents(
  geminiClient: GenAILiveClient | undefined,
  azureClient: AzureOpenAIRealtimeClient | undefined,
  currentMode: ConversationMode
) {
  const { addMessage, updateMessage } = usePersistentChatStore();
  const { activeChatRoom } = useChatManager();
  const { setShowWaveAnimation, setCurrentVolume } = useUIStore();

  // 追蹤目前的 AI 回應訊息 ID 和累積的轉錄內容
  const currentAiMessageRef = useRef<string | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');

  // Azure Realtime API 即時顯示模式：移除暫存機制

  // Live API 用戶轉錄累積器
  const liveApiUserTranscriptRef = useRef<string>('');

  // 使用共用的訊息工廠函數

  // 監聽聊天室切換，重置 AI 回應狀態
  useEffect(() => {
    // 當切換到不同聊天室時，重置 AI 回應狀態
    // 但只在真的有變化時才重置，避免不必要的中斷
    if (activeChatRoom) {
      console.log('🔄 聊天室切換，重置 AI 回應狀態:', activeChatRoom);
      currentAiMessageRef.current = null;
      accumulatedTranscriptRef.current = '';
      liveApiUserTranscriptRef.current = ''; // 重置 Live API 用戶轉錄累積器
      setShowWaveAnimation(false);
      setCurrentVolume(0);
    }
  }, [activeChatRoom, setShowWaveAnimation, setCurrentVolume]);

  // 訂閱 Realtime API 的事件 (Live API 和 Azure API)
  useEffect(() => {
    // 根據當前模式選擇正確的客戶端
    const client = currentMode === 'azure-realtime' ? azureClient : geminiClient;

    // 只有在 Realtime API 模式且有客戶端時才監聽事件
    if ((currentMode !== 'live-api' && currentMode !== 'azure-realtime') || !client) {
      // 不是 Realtime API 模式或沒有 client，退出 useEffect
      return;
    }
    
    // console.log('設置 Live API 事件監聽器');
    
    // 測試事件監聽器設置
    // console.log('Client 對象:', client);
    // console.log('Client 事件方法:', {
    //   hasOn: typeof client.on === 'function',
    //   hasOff: typeof client.off === 'function'
    // });
    
    // 處理 Live API content 事件（主要用於文字模式的向後相容）
    const stableHandleAIResponse = (content: any) => {
      console.log('🔥🔥🔥 [use-conversation-events] 收到 Live API content 事件:', {
        hasModelTurn: !!content.modelTurn,
        currentMessageId: currentAiMessageRef.current,
        activeChatRoom: activeChatRoom,
        content: content
      });
      
      if (!activeChatRoom) {
        console.log('❌ [use-conversation-events] 沒有活動聊天室，跳過處理');
        return;
      }

      // 處理文字模式的回應（向後相容）
      let responseText = '';
      if (content.modelTurn && content.modelTurn.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.text) {
            responseText += part.text;
          }
        }
      }

      if (responseText.trim()) {
        const fullContent = responseText.trim();
        
        console.log('🎯 [use-conversation-events] 處理 AI 文字回應:', {
          contentLength: fullContent.length,
          hasCurrentMessage: !!currentAiMessageRef.current,
          content: fullContent.substring(0, 100) + '...',
          fullContent: fullContent
        });

        if (!currentAiMessageRef.current) {
          const aiMessage = createAssistantMessage(fullContent);
          currentAiMessageRef.current = aiMessage.id;
          // console.log('創建新的 AI 文字訊息:', aiMessage.id);
          addMessage(activeChatRoom, aiMessage);
        } else {
          updateMessage?.(activeChatRoom, currentAiMessageRef.current, (msg) => {
            if (msg.content !== fullContent) {
              // console.log('文字內容有變化，更新訊息:', {
              //   oldLength: msg.content.length,
              //   newLength: fullContent.length
              // });
              return { ...msg, content: fullContent };
            }
            return msg;
          });
        }
      }
    };

    const stableHandleTurnComplete = () => {
      console.log('AI 回應完成，關閉打字狀態:', {
        messageId: currentAiMessageRef.current,
        activeChatRoom: activeChatRoom
      });

      // 停止波浪動畫
      setShowWaveAnimation(false);
      setCurrentVolume(0);

      // 重置當前 AI 訊息 ID 和累積器，準備下次對話
      currentAiMessageRef.current = null;
      accumulatedTranscriptRef.current = '';
    };
    
    // 處理語音轉錄事件 - 需要區分 Live API 和 Azure Realtime API 的行為
    const stableHandleOutputTranscription = (transcription: any) => {
      if (!activeChatRoom) return;

      const newText = transcription.text?.trim();
      if (newText) {
        // 根據當前模式決定處理邏輯
        if (currentMode === 'azure-realtime') {
          // Azure Realtime API: 改為即時顯示模式
          if (!currentAiMessageRef.current) {
            // AI 首次開始轉錄，立即創建並顯示訊息
            console.log('🚀 [conversation-events] Azure AI 開始轉錄，立即創建訊息:', newText);

            accumulatedTranscriptRef.current = newText;
            const aiMessage = createAssistantMessage(newText);
            currentAiMessageRef.current = aiMessage.id;
            addMessage(activeChatRoom, aiMessage);
          } else {
            // AI 訊息已存在，更新內容
            if (transcription.isFinal) {
              // 最終轉錄，直接設置完整內容
              accumulatedTranscriptRef.current = newText;
              console.log('✅ [conversation-events] Azure AI 最終轉錄:', newText);
            } else {
              // 處理增量轉錄（delta）
              // Azure Realtime API 的增量轉錄可能是累積性的或增量性的
              // 檢查新文字是否包含舊內容，避免重複累積
              if (newText.includes(accumulatedTranscriptRef.current)) {
                // 新文字是累積結果，直接替換
                accumulatedTranscriptRef.current = newText;
                console.log('🔄 [conversation-events] Azure AI 累積轉錄 (替換):', newText);
              } else if (accumulatedTranscriptRef.current.includes(newText)) {
                // 舊內容已包含新片段，不需要更新（避免重複）
                console.log('🔄 [conversation-events] Azure AI 重複片段，跳過:', newText);
                return;
              } else {
                // 增量片段，追加
                accumulatedTranscriptRef.current += newText;
                console.log('🔄 [conversation-events] Azure AI 增量轉錄 (追加):', newText);
              }
            }

            // 即時更新 AI 訊息內容
            updateMessage?.(activeChatRoom, currentAiMessageRef.current, (msg) => {
              return {
                ...msg,
                content: accumulatedTranscriptRef.current
              };
            });
          }
        } else if (currentMode === 'live-api') {
          // Live API: 新邏輯 - AI 開始轉錄時創建用戶訊息
          if (!currentAiMessageRef.current) {
            // AI 首次開始轉錄，這是創建用戶訊息的最佳時機
            console.log('🚀 [conversation-events] Live API AI 開始轉錄，創建用戶訊息');

            // 1. 先創建用戶訊息（如果有累積的轉錄）
            if (liveApiUserTranscriptRef.current.trim()) {
              console.log('📝 [conversation-events] 創建用戶訊息:', liveApiUserTranscriptRef.current);
              const userMessage = createUserMessage(liveApiUserTranscriptRef.current.trim());
              addMessage(activeChatRoom, userMessage);

              // 清除用戶轉錄累積器
              liveApiUserTranscriptRef.current = '';
            }

            // 2. 創建 AI 訊息
            accumulatedTranscriptRef.current = newText;
            const aiMessage = createAssistantMessage(newText);
            currentAiMessageRef.current = aiMessage.id;
            addMessage(activeChatRoom, aiMessage);
          } else {
            // AI 訊息已存在，繼續更新內容
            if (transcription.isFinal) {
              // 最終轉錄，直接設置
              accumulatedTranscriptRef.current = newText;
            } else {
              // 增量轉錄，累積
              accumulatedTranscriptRef.current += newText;
            }

            // 更新 AI 訊息內容
            updateMessage?.(activeChatRoom, currentAiMessageRef.current, (msg) => {
              return {
                ...msg,
                content: accumulatedTranscriptRef.current
              };
            });
          }
        }
      }
    };

    // 處理用戶語音輸入轉錄事件
    const stableHandleInputTranscription = (transcription: any) => {
      if (!activeChatRoom) return;

      const newFragment = transcription.text?.trim();
      if (newFragment) {
        // 根據不同 API 的行為調整處理邏輯
        console.log('🔍 [conversation-events] 用戶轉錄檢查:', {
          text: newFragment,
          textLength: newFragment.length,
          isFinal: transcription.isFinal,
          hasIsFinalProperty: transcription.hasOwnProperty('isFinal'),
          mode: currentMode
        });

        // 針對不同 API 的處理邏輯
        if (currentMode === 'live-api') {
          // Live API: 採用延遲顯示策略 - 累積轉錄，等 AI 回應完成時一起顯示
          console.log('🎤 [conversation-events] Live API 累積用戶轉錄:', {
            newFragment: newFragment,
            accumulated: liveApiUserTranscriptRef.current,
            willAccumulate: true
          });

          // Live API 轉錄行為分析：
          // - 片段可能是累積性的（如：'我' -> '我姓' -> '我姓吳'）
          // - 也可能是增量的（如：'我' + '姓' + '吳'）
          // 採用智能累積策略：如果新片段包含舊內容，則替換；否則追加

          if (!liveApiUserTranscriptRef.current) {
            // 第一個片段
            liveApiUserTranscriptRef.current = newFragment;
          } else {
            // 檢查新片段是否包含舊內容（累積性）
            if (newFragment.includes(liveApiUserTranscriptRef.current)) {
              // 新片段是累積結果，直接替換
              liveApiUserTranscriptRef.current = newFragment;
            } else if (liveApiUserTranscriptRef.current.includes(newFragment)) {
              // 舊內容已包含新片段，不需要更新
              // 這種情況可能是重複事件，保持不變
            } else {
              // 增量片段，追加（用空格連接）
              liveApiUserTranscriptRef.current += ' ' + newFragment;
            }
          }

          console.log('📝 [conversation-events] Live API 累積結果:', liveApiUserTranscriptRef.current);

          // Live API 模式：純粹累積用戶轉錄，等待 AI 開始回應時創建訊息

        } else {
          // Azure Realtime API 和其他 API：保持原有邏輯
          const shouldProcess = (() => {
            if (currentMode === 'azure-realtime') {
              // Azure Realtime API: 使用 isFinal 判斷
              return transcription.isFinal || (!transcription.hasOwnProperty('isFinal'));
            } else {
              // 其他 API：原有邏輯
              return transcription.isFinal || (!transcription.hasOwnProperty('isFinal'));
            }
          })();

          if (shouldProcess) {
            console.log('🎤 [conversation-events] 用戶轉錄完成:', {
              text: newFragment,
              textLength: newFragment.length,
              isFinal: transcription.isFinal,
              hasIsFinalProperty: transcription.hasOwnProperty('isFinal'),
              mode: currentMode
            });

            // 直接插入用戶訊息，不再處理暫存的 AI 訊息
            const userMessage = createUserMessage(newFragment);
            addMessage(activeChatRoom, userMessage);
          } else {
            // 非最終轉錄，記錄但不創建訊息
            console.log('🎤 [conversation-events] 用戶轉錄中間結果:', {
              text: newFragment.substring(0, 20) + '...',
              isFinal: false,
              mode: currentMode
            });
          }
        }
      }
    };

    console.log('🔧 [use-conversation-events] 註冊事件監聽器:', {
      mode: currentMode,
      hasClient: !!client,
      clientType: currentMode === 'azure-realtime' ? 'AzureClient' : 'GeminiClient'
    });

    // 根據客戶端類型分別註冊事件
    if (currentMode === 'azure-realtime' && azureClient) {
      console.log('🔗 [conversation-events] 註冊 Azure 事件監聽器');
      azureClient.on('content', stableHandleAIResponse);
      azureClient.on('input_transcription', stableHandleInputTranscription);
      azureClient.on('output_transcription', stableHandleOutputTranscription);
      azureClient.on('turncomplete', stableHandleTurnComplete);
    } else if (currentMode === 'live-api' && geminiClient) {
      console.log('🔗 [conversation-events] 註冊 Gemini 事件監聽器');
      geminiClient.on('content', stableHandleAIResponse);
      geminiClient.on('input_transcription', stableHandleInputTranscription);
      geminiClient.on('output_transcription', stableHandleOutputTranscription);
      geminiClient.on('turncomplete', stableHandleTurnComplete);
    } else {
      console.warn('⚠️ [conversation-events] 沒有可用的客戶端或模式不匹配:', {
        currentMode,
        hasGeminiClient: !!geminiClient,
        hasAzureClient: !!azureClient
      });
    }

    // 事件監聽器註冊完成

    return () => {
      // console.log('清理 Live API 事件監聽器');
      if (currentMode === 'azure-realtime' && azureClient) {
        azureClient.off('content', stableHandleAIResponse);
        azureClient.off('input_transcription', stableHandleInputTranscription);
        azureClient.off('output_transcription', stableHandleOutputTranscription);
        azureClient.off('turncomplete', stableHandleTurnComplete);
      } else if (currentMode === 'live-api' && geminiClient) {
        geminiClient.off('content', stableHandleAIResponse);
        geminiClient.off('input_transcription', stableHandleInputTranscription);
        geminiClient.off('output_transcription', stableHandleOutputTranscription);
        geminiClient.off('turncomplete', stableHandleTurnComplete);
      }
    };
  }, [geminiClient, azureClient, currentMode, activeChatRoom, addMessage, updateMessage, setShowWaveAnimation, setCurrentVolume]);

  // 當新的文字訊息發送時，重置 AI 回應狀態
  const resetAIResponseState = useCallback(() => {
    // console.log('🔄 重置 AI 回應狀態');
    currentAiMessageRef.current = null;
    accumulatedTranscriptRef.current = '';
  }, []);

  return {
    resetAIResponseState
  };
}