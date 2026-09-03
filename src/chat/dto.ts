import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsBooleanString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class PromptDTO {
  @IsNotEmpty()
  input: string;

  @IsOptional()
  @IsUUID('4', { each: true })
  files_ids?: string[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => ['true', true].includes(value))
  with_search?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => ['true', true].includes(value))
  with_thinking?: boolean;
}

export class CreateChatDTO {
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  model_id: number;
}
