import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateChatDTO {
  @IsString()
  @IsNotEmpty()
  model_id: string;
}

export class PatchChatDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => ['true', true].includes(value))
  is_pinned: boolean;
}

export class SearchChatsDto {
  @IsOptional()
  @IsString()
  search: string;
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
