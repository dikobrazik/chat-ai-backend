import { MessageParam } from '@anthropic-ai/sdk/resources';
import { InjectRepository } from '@nestjs/typeorm';
import { Prompt } from 'src/entities/Prompt';
import { Repository } from 'typeorm';

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

  getFilePayload(responseId: string, content: string, index: number) {
    return {
      promptId: responseId,
      content,
      isComplete: false,
      timestamp: new Date(),
      index,
    };
  }

  getDeltaPayload(responseId: string, content: string, index: number) {
    return {
      promptId: responseId,
      content,
      isComplete: false,
      timestamp: new Date(),
      index,
    };
  }

  getCompletePayload(responseId: string, content: string) {
    return {
      index: -1,
      promptId: responseId,
      content,
      isComplete: true,
      timestamp: new Date(),
    };
  }
}
