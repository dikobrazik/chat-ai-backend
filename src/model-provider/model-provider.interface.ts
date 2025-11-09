export interface IModelProvider {
  id: number;
  name: string;
  createConversation(): Promise<string>;
  generateResponse(
    conversationId: string,
    model: string,
    input: string,
  ): Promise<{ id: string; text: string }>;
}
