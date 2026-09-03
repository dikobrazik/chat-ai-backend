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
    options?: GenerateStreamResponseOptions,
  ): Promise<Observable<UnifiedAIStreamChunk>>;
  generateImageResponse(
    conversationId: string,
    model: string,
    input: string,
  ): Promise<Observable<UnifiedAIStreamChunk>>;
}

export type GenerateStreamResponseOptions = {
  files?: InputFile[];
  withThinking?: boolean;
  withSearch?: boolean;
};

export interface UnifiedAIStreamChunkMain {
  index: number;
  content?: string;
  imageB64?: string;
  type: 'delta' | 'thinking' | 'complete' | 'error';
  /**
   * @deprecated Use `type` instead. This field is kept for backward compatibility.
   */
  isComplete: boolean;
  /**
   * @deprecated Use `type` instead. This field is kept for backward compatibility.
   */
  isThinking?: boolean;
  timestamp: Date;
  promptId: string;
  error?: string;
}

export interface UnifiedAIStreamChunkMeta {
  type: 'meta';
  promptId: string;
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
}

export type UnifiedAIStreamChunk =
  | UnifiedAIStreamChunkMain
  | UnifiedAIStreamChunkMeta;

export type InputFile = {
  id: string;
  blob: Blob;
  name: string;
  mimeType: string;
};
