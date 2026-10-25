import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FuenteTipo, TipoGarantia } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ArchivoDto } from '../common/archivos';

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export class NegocioDto {
  @ApiPropertyOptional({ example: 'Tienda Doña Gloria' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombre?: string;

  @ApiPropertyOptional({ example: 'Gloria Pérez' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombrePropietario?: string;

  @ApiPropertyOptional({ example: 'tienda' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  tipo?: string;

  @ApiPropertyOptional({ example: 'Kennedy' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  barrio?: string;

  @ApiPropertyOptional({ example: 36 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1200)
  antiguedadMeses?: number;

  @ApiPropertyOptional({ example: 9000000, description: 'Ventas promedio de un mes, en pesos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  ventasMensualesDeclaradas?: number;
}

export class ConsentimientoDto {
  @ApiProperty({ enum: [FuenteTipo.DATAFONO, FuenteTipo.DISTRIBUIDOR, FuenteTipo.OPEN_FINANCE] })
  @IsEnum(FuenteTipo)
  fuente: FuenteTipo;

  @ApiProperty({ example: 'Bold' })
  @IsString()
  @MaxLength(60)
  proveedor: string;
}

export class VentaManualDto {
  @ApiProperty({ example: '2026-08' })
  @Matches(MES, { message: 'El mes debe tener formato AAAA-MM' })
  mes: string;

  @ApiProperty({ example: 8500000 })
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  ventas: number;
}

export class VentasManualesDto {
  @ApiProperty({ type: [VentaManualDto] })
  @ValidateNested({ each: true })
  @Type(() => VentaManualDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  meses: VentaManualDto[];
}

export class CrearSolicitudDto {
  @ApiProperty({ example: 3000000, description: 'Monto en pesos' })
  @IsInt()
  @Min(200_000)
  @Max(50_000_000)
  monto: number;

  @ApiProperty({ example: 'Surtir la tienda para diciembre' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  destino: string;

  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  @Max(36)
  plazoMeses: number;
}

export class VariacionDto {
  @ApiProperty({ example: '2026-01' })
  @Matches(MES, { message: 'El mes debe tener formato AAAA-MM' })
  mes: string;

  @ApiProperty({ example: 'Obras en la calle durante todo el mes' })
  @IsString()
  @MinLength(3)
  @MaxLength(280)
  motivo: string;

  @ApiPropertyOptional({ type: ArchivoDto, description: 'Evidencia opcional: foto o PDF' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ArchivoDto)
  evidencia?: ArchivoDto;
}

export class EnviarDto {
  @ApiProperty()
  @IsUUID()
  aliadoId: string;
}

export class RespuestaGarantiaDto {
  @ApiProperty({ example: 'Mi hermano puede ser codeudor. Se llama ... y trabaja en ...' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  respuesta: string;

  @ApiPropertyOptional({ type: ArchivoDto, description: 'Documento de la garantía: foto o PDF' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ArchivoDto)
  documento?: ArchivoDto;
}

export class SatisfaccionDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  calificacion: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}

export { TipoGarantia };
