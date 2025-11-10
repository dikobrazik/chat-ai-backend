import { Observable } from 'rxjs';

export interface IModelProvider {
  id: number;
  name: string;
  createConversation(): Promise<string>;
  generateResponse(
    conversationId: string,
    model: string,
    input: string,
  ): Promise<{ id: string; text: string }>;
  generateStreamResponse(
    conversationId: string,
    model: string,
    input: string,
  ): Promise<Observable<UnifiedAIStreamChunk>>;
}

export interface UnifiedAIStreamChunk {
  index: number;
  content: string;
  isComplete: boolean;
  timestamp: Date;
  promptId: string;
  error?: string;
}
