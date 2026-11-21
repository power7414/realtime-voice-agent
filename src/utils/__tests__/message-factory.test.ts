import { createUserMessage, createAssistantMessage } from '../message-factory';

describe('MessageFactory 工具單元測試', () => {
  it('應該成功建立使用者訊息並清除前後空白', () => {
    const rawContent = '   Hello Antigravity AI!   ';
    const message = createUserMessage(rawContent);

    expect(message.type).toBe('user');
    expect(message.content).toBe('Hello Antigravity AI!');
    expect(message.id).toBeDefined();
    expect(typeof message.id).toBe('string');
  });

  it('應該成功建立 AI Assistant 訊息', () => {
    const content = '這是一條 AI 產生的測試回覆';
    const message = createAssistantMessage(content);

    expect(message.type).toBe('assistant');
    expect(message.content).toBe(content);
    expect(message.id).toBeDefined();
  });
});
