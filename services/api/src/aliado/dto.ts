import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoSolicitud, TipoGarantia } from '@prisma/client';
import {
  IsBoolean,
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
  @IsOptional()
  @IsInt()
  @Min(100_000)
  @Max(500_000_000)
  montoAprobado?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  plazoAprobado?: number;

  @ApiPropertyOptional({ example: 52.5, description: 'Tasa efectiva anual, en %' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(150)
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
