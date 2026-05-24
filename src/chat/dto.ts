import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class PromptParamsDTO {
  @IsUUID()
  id: string;
}

export class PromptDTO {
  @IsNotEmpty()
  input: string;

  // @IsUUID('4', { each: true })
  files_ids: string[];
}

export class CreateChatDTO {
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  model_id: number;
}
