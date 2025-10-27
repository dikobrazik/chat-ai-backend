export interface IModelProvider {
  id: number;
  name: string;
  createConversation(): Promise<string>;
  generateResponse(
    model: string,
    input: string,
  ): Promise<{ id: string; text: string }>;
}
