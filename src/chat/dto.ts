import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateChatDTO {
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  model_id: number;
}

export class PatchChatDto {
  @IsString()
  @MinLength(3)
  title: string;
}

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
