import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class SolicitarOtpDto {
  @ApiProperty({ example: '3001234567' })
  @IsString()
  @MaxLength(20)
  celular: string;
}

export class VerificarOtpDto {
  @ApiProperty({ example: '3001234567' })
  @IsString()
  @MaxLength(20)
  celular: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'El código tiene 6 dígitos' })
  codigo: string;
}

export class LoginAliadoDto {
  @ApiProperty({ example: 'analista@bancodemo.co' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}

export class MfaDto {
  @ApiProperty({ description: 'Token intermedio devuelto por /auth/aliado/login' })
  @IsString()
  mfaToken: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  codigo: string;
}

export class AceptarInvitacionDto {
  @ApiProperty({ description: 'Mínimo 12 caracteres, con letras y números' })
  @IsString()
  @MinLength(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
  @MaxLength(200)
  @Matches(/(?=.*\p{L})(?=.*\d)/u, { message: 'La contraseña debe tener letras y números' })
  password: string;
}
