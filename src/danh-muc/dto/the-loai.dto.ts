import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTheLoaiDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maTheLoai!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  tenTheLoai!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  moTa?: string;
}

export class UpdateTheLoaiDto extends PartialType(CreateTheLoaiDto) {}
