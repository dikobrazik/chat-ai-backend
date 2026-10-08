import { IsBoolean, IsString, MaxLength, ValidateIf } from 'class-validator';

export class PatchUserDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  mailing_consent?: boolean;
}
