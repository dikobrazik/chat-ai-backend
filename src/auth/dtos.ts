import { IsEmail, Length, MinLength } from 'class-validator';

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
