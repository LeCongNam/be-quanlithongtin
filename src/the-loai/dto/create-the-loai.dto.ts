import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateTheLoaiDto {
  @ApiProperty({ example: 'TL01', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  ma_the_loai!: string;

  @ApiProperty({ example: 'Công nghệ thông tin', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  ten_the_loai!: string;

  @ApiPropertyOptional({ example: 'Sách về công nghệ thông tin', maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  mo_ta?: string;
}
