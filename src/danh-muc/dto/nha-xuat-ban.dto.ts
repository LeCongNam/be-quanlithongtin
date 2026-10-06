import { PartialType } from '@nestjs/mapped-types';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateNhaXuatBanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  maNxb!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  tenNxb!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  diaChi?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sdt?: string;
}

export class UpdateNhaXuatBanDto extends PartialType(CreateNhaXuatBanDto) {}
