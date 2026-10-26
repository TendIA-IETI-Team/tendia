import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class MensajeDto {
  @ApiProperty({ example: 'Hoy vendí 350 mil y le fié 20 mil a don Pedro' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  mensaje: string;
}

export class VentaDiariaDto {
  @ApiProperty({ example: 350000 })
  @IsInt()
  @Min(1)
  @Max(500_000_000)
  monto: number;

  @ApiPropertyOptional({ example: '2026-10-24' })
  @IsOptional()
  @Matches(FECHA, { message: 'La fecha debe tener formato AAAA-MM-DD' })
  fecha?: string;
}

export class FiadoDto {
  @ApiProperty({ example: 'Don Pedro' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  cliente: string;

  @ApiProperty({ example: 20000 })
  @IsInt()
  @Min(1)
  @Max(50_000_000)
  monto: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(FECHA, { message: 'La fecha debe tener formato AAAA-MM-DD' })
  fecha?: string;
}

export class EstimacionVentasDto {
  @ApiProperty({ example: 150000, description: 'Lo que vende en un día normal' })
  @IsInt()
  @Min(0)
  @Max(50_000_000)
  diaNormal: number;

  @ApiProperty({ example: 60000, description: 'Lo que vende en un día flojo' })
  @IsInt()
  @Min(0)
  @Max(50_000_000)
  diaFlojo: number;

  @ApiProperty({ example: 2, description: 'Cuántos días flojos tiene una semana' })
  @IsInt()
  @Min(0)
  @Max(7)
  diasFlojosPorSemana: number;
}

export class CuadernoDto {
  @ApiProperty({ description: 'Foto en base64 (máximo 5 MB)' })
  @IsString()
  @MaxLength(7_500_000)
  imagenBase64: string;

  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'] })
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  tipo: string;
}

class FiadoLeidoDto {
  @IsString()
  @MaxLength(60)
  cliente: string;

  @IsNumber()
  @Min(1)
  monto: number;
}

class RegistroLeidoDto {
  @IsOptional()
  @Matches(FECHA)
  fecha: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ventas: number | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FiadoLeidoDto)
  fiados: FiadoLeidoDto[];
}

export class ConfirmarCuadernoDto {
  @ApiPropertyOptional({
    description: 'Registros corregidos por el tendero; si no, se guarda lo leído',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(62)
  @ValidateNested({ each: true })
  @Type(() => RegistroLeidoDto)
  registros?: RegistroLeidoDto[];
}
