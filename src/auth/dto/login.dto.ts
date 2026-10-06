import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ad001' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  tenDangNhap!: string;

  @ApiProperty({ example: 'AD001@Nhom8' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72) // giới hạn của bcrypt
  matKhau!: string;
}
