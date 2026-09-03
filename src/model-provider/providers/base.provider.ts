import { MessageParam } from '@anthropic-ai/sdk/resources';
import { InjectRepository } from '@nestjs/typeorm';
import { Prompt } from 'src/entities/Prompt';
import { Repository } from 'typeorm';
import {
  UnifiedAIStreamChunkMain,
  UnifiedAIStreamChunkMeta,
} from '../model-provider.interface';

export abstract class BaseProvider {
  @InjectRepository(Prompt)
  private readonly promptRepository: Repository<Prompt>;

  async getPreviousMessages(chatId: string): Promise<MessageParam[]> {
    const previousPrompts = await this.promptRepository.find({
      select: { input: true, response: true, files: true },
      where: { chat_id: chatId },
    });

    return previousPrompts
      .map((prompt) => [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt.input }],
        } satisfies MessageParam,
        { role: 'assistant', content: prompt.response } satisfies MessageParam,
      ])
      .flat();
  }

  getFilePayload(promptId: string, content: string, index: number) {
    return {
      promptId,
      content,
      isComplete: false,
      timestamp: new Date(),
      index,
    };
  }

  getMetaPayload(
    promptId: string,
    inputTokens: number,
    outputTokens: number,
    thinkingTokens: number,
  ): UnifiedAIStreamChunkMeta {
    return {
      type: 'meta',
      promptId,
      inputTokens,
      outputTokens,
      thinkingTokens,
    };
  }

  getDeltaPayload(
    promptId: string,
    content: string,
    index: number,
  ): UnifiedAIStreamChunkMain {
    return {
      type: 'delta',
      promptId,
      content,
      isComplete: false,
      timestamp: new Date(),
      index,
    };
  }

  getThinkingPayload(
    promptId: string,
    content: string,
    index: number,
  ): UnifiedAIStreamChunkMain {
    return {
      type: 'thinking',
      promptId,
      content,
      isComplete: false,
      isThinking: true,
      timestamp: new Date(),
      index,
    };
  }

  getCompletePayload(
    promptId: string,
    content: string,
  ): UnifiedAIStreamChunkMain {
    return {
      type: 'complete',
      index: -1,
      promptId,
      content,
      isComplete: true,
      timestamp: new Date(),
    };
  }

  getImagePayload(
    promptId: string,
    imageB64: string,
  ): UnifiedAIStreamChunkMain {
    return {
      type: 'complete',
      promptId,
      imageB64: imageB64,
      isComplete: true,
      timestamp: new Date(),
      index: -1,
    };
  }

  getErrorPayload(message: string): UnifiedAIStreamChunkMain {
    return {
      index: -1,
      promptId: '',
      type: 'error',
      content: '',
      isComplete: true,
      timestamp: new Date(),
      error: message,
    };
  }
}
