import { IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { MODELS } from './models';

export class PromptDTO {
  @IsNotEmpty()
  input: string;

  @IsUUID()
  @IsOptional()
  chatId?: string;

  @IsIn(MODELS.map((model) => model.id))
  @IsOptional()
  model?: (typeof MODELS)[number]['id'];
}
