import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTacGiaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maTacGia!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  tenTacGia!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  quocTich?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  namSinh?: number;
}

export class UpdateTacGiaDto extends PartialType(CreateTacGiaDto) {}
