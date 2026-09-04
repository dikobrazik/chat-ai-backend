import { IsEmail, IsString, Length, MinLength } from 'class-validator';

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
