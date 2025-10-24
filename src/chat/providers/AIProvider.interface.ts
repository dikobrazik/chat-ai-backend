export interface AIProvider {
  createResponse(): Promise<{ id: string; text: string }>;
}
