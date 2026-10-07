import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ApiErrors } from '../common/swagger/api-errors.decorator.js';
import { AuthService } from './auth.service.js';
import { JwtUserDto, LoginResponseDto } from './dto/auth.response.dto.js';
import { LoginDto } from './dto/login.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Đăng nhập',
    description:
      'Trả JWT; gửi ở header `Authorization: Bearer <accessToken>` cho mọi API khác. Sai tên đăng nhập hoặc mật khẩu cùng một thông báo 401. Tài khoản/người dùng bị khóa cũng trả 401.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiErrors(400, 401)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({
    summary: 'Thông tin tài khoản đang đăng nhập',
    description:
      'Lấy từ JWT (không có `hoTen`); `exp` cho biết token hết hạn lúc nào.',
  })
  @ApiOkResponse({ type: JwtUserDto })
  @ApiErrors(401)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
