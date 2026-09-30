import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class MailingConsentQueryDto {
  @IsOptional()
  @IsIn(['1'])
  mailing_consent?: '1';
}

export class CheckEmailDto {
  @IsEmail()
  email: string;
}

export class EmailAuthDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;
}

export class EmailVerifyDto {
  @IsEmail()
  email: string;

  @Length(6)
  code: string;
}

export class PasswordResetDto {
  @IsEmail()
  email: string;
}

export class PasswordResetVerifyDto {
  @IsString()
  code: string;

  @MinLength(6)
  password: string;
}
