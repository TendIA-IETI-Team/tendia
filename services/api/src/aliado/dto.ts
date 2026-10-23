import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoSolicitud, TipoGarantia } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
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

export class DecisionDto {
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

export class EvaluarGarantiaDto {
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
  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(0)
  @Max(100)
  scoreMinAprobar: number;

  @ApiProperty({ example: 45 })
  @IsInt()
  @Min(0)
  @Max(100)
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
