import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoSolicitud, TipoGarantia } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class FiltroBandejaDto {
  @ApiPropertyOptional({ enum: EstadoSolicitud })
  @IsOptional()
  @IsEnum(EstadoSolicitud)
  estado?: EstadoSolicitud;
}

/** Condiciones con que se aprueba (A4). Si no se envían, se aprueba lo que pidió el tendero. */
class CondicionesDto {
  @ApiPropertyOptional({ example: 3000000 })
  // Mensajes en español: el portal se los muestra tal cual al analista.
  @IsOptional()
  @IsInt({ message: 'El monto debe ser un número entero de pesos' })
  @Min(100_000, { message: 'El monto debe ser de al menos $100.000' })
  @Max(500_000_000, { message: 'El monto no puede pasar de $500.000.000' })
  montoAprobado?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt({ message: 'El plazo debe ser un número entero de meses' })
  @Min(1, { message: 'El plazo debe ser de al menos 1 mes' })
  @Max(60, { message: 'El plazo no puede pasar de 60 meses' })
  plazoAprobado?: number;

  @ApiPropertyOptional({ example: 52.5, description: 'Tasa efectiva anual, en %' })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La tasa debe ser un número con máximo dos decimales, por ejemplo 52,5' },
  )
  @Min(0, { message: 'La tasa no puede ser negativa' })
  @Max(150, { message: 'La tasa no puede pasar de 150 % E.A.' })
  tasaAprobada?: number;
}

export class DecisionDto extends CondicionesDto {
  @ApiProperty({ enum: ['APROBAR', 'PEDIR_GARANTIA', 'RECHAZAR'] })
  @IsIn(['APROBAR', 'PEDIR_GARANTIA', 'RECHAZAR'])
  decision: 'APROBAR' | 'PEDIR_GARANTIA' | 'RECHAZAR';

  @ApiPropertyOptional({ example: 'Cumple la política de riesgo.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;

  @ApiPropertyOptional({ enum: TipoGarantia })
  @IsOptional()
  @IsEnum(TipoGarantia)
  tipoGarantia?: TipoGarantia;
}

export class EvaluarGarantiaDto extends CondicionesDto {
  @ApiProperty()
  @IsBoolean()
  aceptar: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;
}

export class PoliticaDto {
  @ApiProperty({ example: 650, description: 'Escala 0-1000' })
  @IsInt()
  @Min(0)
  @Max(1000)
  scoreMinAprobar: number;

  @ApiProperty({ example: 500, description: 'Escala 0-1000' })
  @IsInt()
  @Min(0)
  @Max(1000)
  scoreMinConGarantia: number;

  @ApiProperty({ example: 5000000 })
  @IsInt()
  @Min(100_000)
  @Max(500_000_000)
  montoMaximo: number;
}

export class CrearApiKeyDto {
  @ApiProperty({ example: 'Integración core bancario' })
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  nombre: string;
}

export class InvitacionDto {
  @ApiProperty({ example: 'analista.nueva@bancodemo.co' })
  @IsEmail({}, { message: 'Escribe un correo válido' })
  @MaxLength(160)
  email: string;

  @ApiProperty({ example: 'Laura Gómez' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre: string;

  @ApiPropertyOptional({ enum: ['ANALISTA', 'ADMIN_ALIADO'], default: 'ANALISTA' })
  @IsOptional()
  @IsIn(['ANALISTA', 'ADMIN_ALIADO'])
  rol?: 'ANALISTA' | 'ADMIN_ALIADO';
}
