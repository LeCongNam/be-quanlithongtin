import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  diaChi?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sdt?: string;
}

export class UpdateNhaXuatBanDto extends PartialType(CreateNhaXuatBanDto) {}
