import { ApiProperty } from '@nestjs/swagger';
import { VaiTroTaiKhoan } from '../../common/db-enums.js';
import { ApiEnum } from '../../common/swagger/api-types.js';

/** Nội dung JWT (`AuthUser`); cũng là kết quả của GET /auth/me. */
export class AuthUserDto {
  @ApiProperty({
    example: '13',
    description: 'nguoi_dung.id (BIGINT dạng chuỗi)',
  })
  nguoiDungId!: string;

  @ApiProperty({
    example: 'AD001',
    description: 'Mã người dùng (dùng làm tham số maNguoiDung ở các API khác)',
  })
  maNguoiDung!: string;

  @ApiProperty({ example: 'ad001' })
  tenDangNhap!: string;

  @ApiEnum(VaiTroTaiKhoan, 'VaiTroTaiKhoan')
  vaiTro!: VaiTroTaiKhoan;
}

/** Kết quả GET /auth/me: nội dung JWT, kèm thời điểm cấp/hết hạn (giây Unix) để FE biết khi nào phải đăng nhập lại. */
export class JwtUserDto extends AuthUserDto {
  @ApiProperty({
    type: 'integer',
    example: 1791360000,
    description: 'Thời điểm cấp token (giây Unix)',
  })
  iat!: number;

  @ApiProperty({
    type: 'integer',
    example: 1791388800,
    description: 'Thời điểm token hết hạn (giây Unix); sau đó mọi API trả 401',
  })
  exp!: number;
}

export class LoginUserDto extends AuthUserDto {
  @ApiProperty({ example: 'Quản trị hệ thống' })
  hoTen!: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT: gửi ở header `Authorization: Bearer <accessToken>`',
  })
  accessToken!: string;

  @ApiProperty({ type: LoginUserDto })
  user!: LoginUserDto;
}
