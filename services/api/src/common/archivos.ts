import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const TIPOS_ARCHIVO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const MAX_ARCHIVO_BYTES = 5 * 1024 * 1024;

/** Archivo que manda la app en base64: evidencia de T8 o documento de la garantía (T10). */
export class ArchivoDto {
  @ApiProperty({ example: 'recibo-obra.jpg' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre: string;

  @ApiProperty({ enum: TIPOS_ARCHIVO })
  @IsIn(TIPOS_ARCHIVO, { message: 'Solo se aceptan fotos (JPG, PNG, WEBP) o PDF' })
  tipo: (typeof TIPOS_ARCHIVO)[number];

  @ApiProperty({ description: 'Contenido en base64 (máximo 5 MB)' })
  @IsString()
  @MaxLength(Math.ceil((MAX_ARCHIVO_BYTES * 4) / 3) + 64)
  base64: string;
}

/** Decodifica y valida el archivo. Revisa la firma del contenido para que coincida con el tipo. */
export function leerArchivo(a: ArchivoDto): { nombre: string; tipo: string; datos: Buffer } {
  const datos = Buffer.from(a.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!datos.length) throw new BadRequestException('El archivo está vacío');
  if (datos.length > MAX_ARCHIVO_BYTES) {
    throw new BadRequestException('El archivo pesa más de 5 MB');
  }
  const firma = datos.subarray(0, 12).toString('latin1');
  const coincide =
    (a.tipo === 'application/pdf' && firma.startsWith('%PDF')) ||
    (a.tipo === 'image/png' && firma.startsWith('\x89PNG')) ||
    (a.tipo === 'image/jpeg' && datos[0] === 0xff && datos[1] === 0xd8) ||
    (a.tipo === 'image/webp' && firma.startsWith('RIFF') && firma.slice(8, 12) === 'WEBP');
  if (!coincide) throw new BadRequestException('El archivo no corresponde al tipo indicado');
  // Solo letras, números, espacios, puntos, guiones y guiones bajos en el nombre que se guarda.
  const nombre = a.nombre.replace(/[^\p{L}\p{N} ._-]/gu, '_').slice(0, 120);
  return { nombre, tipo: a.tipo, datos };
}
