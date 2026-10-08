import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSachDto {
  @ApiProperty({ example: 'S001', maxLength: 20 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  ma_sach!: string;

  @ApiPropertyOptional({ example: '9780132350884', maxLength: 20 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string;

  @ApiProperty({ example: 'Clean Code', maxLength: 255 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  ten_sach!: string;

  @ApiProperty({ example: 1, minimum: 1, description: 'ID thể loại' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  the_loai_id!: number;

  @ApiProperty({ example: 1, minimum: 1, description: 'ID nhà xuất bản' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nxb_id!: number;

  @ApiPropertyOptional({ example: 2008, minimum: 0, maximum: 9999 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  nam_xuat_ban?: number;

  @ApiPropertyOptional({ example: 'Tiếng Việt', maxLength: 50, default: 'Tieng Viet' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ngon_ngu?: string;

  @ApiPropertyOptional({ example: 'Sách hướng dẫn các nguyên tắc viết mã rõ ràng.' })
  @IsOptional()
  @IsString()
  mo_ta?: string;
}
