import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class PromptDTO {
  @IsNotEmpty()
  input: string;

  @IsOptional()
  @IsUUID('4', { each: true })
  files_ids?: string[];
}

export class CreateChatDTO {
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  model_id: number;
}
