import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  namedRows,
  SACH_DANG_MUON_COLUMNS,
  TIEN_PHAT_COLUMNS,
} from '../common/call-rows.js';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Khu vực "của tôi": luôn dùng mã người dùng trong token, không nhận tham số từ client. */
@ApiTags('ban-doc')
@ApiBearerAuth()
@Controller('me')
export class BanDocController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('sach-dang-muon')
  async sachDangMuon(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >`CALL sp_bandoc_sach_dang_muon(${user.maNguoiDung})`;
    return namedRows(rows, SACH_DANG_MUON_COLUMNS, ['so_ngay_qua_han']);
  }

  @Get('tien-phat')
  async tienPhat(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >`CALL sp_bandoc_tien_phat(${user.maNguoiDung})`;
    return namedRows(rows, TIEN_PHAT_COLUMNS);
  }
}
