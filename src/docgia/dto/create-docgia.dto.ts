import { LoaiNguoiDung, TrangThaiNguoiDung } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
	ValidateIf,
} from 'class-validator';

export class CreateDocgiaDto {
	@ApiProperty({ example: 'DG001', maxLength: 20 })
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(20)
	ma_nguoi_dung!: string;

	@ApiProperty({ example: 'Nguyễn Văn An', maxLength: 160 })
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(160)
	ho_ten!: string;

	@ApiProperty({ enum: LoaiNguoiDung, example: LoaiNguoiDung.SINH_VIEN })
	@IsEnum(LoaiNguoiDung)
	loai_nguoi_dung!: LoaiNguoiDung;

	@ApiPropertyOptional({
		enum: TrangThaiNguoiDung,
		example: TrangThaiNguoiDung.HOAT_DONG,
		default: TrangThaiNguoiDung.HOAT_DONG,
	})
	@IsEnum(TrangThaiNguoiDung)
	@IsOptional()
	trang_thai?: TrangThaiNguoiDung;

	@ApiPropertyOptional({ example: 'an.nguyen@example.com', maxLength: 120 })
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@ValidateIf((_object, value) => value !== undefined && value !== null && value !== '')
	@IsString()
	@MaxLength(120)
	@IsEmail()
	email?: string;

	@ApiPropertyOptional({ example: '0901234567', maxLength: 20 })
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsOptional()
	@IsString()
	@MaxLength(20)
	sdt?: string;

	@ApiPropertyOptional({ example: 'Khoa Công nghệ thông tin', maxLength: 160 })
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsOptional()
	@IsString()
	@MaxLength(160)
	khoa_don_vi?: string;
}
