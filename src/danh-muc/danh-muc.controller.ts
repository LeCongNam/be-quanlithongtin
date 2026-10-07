import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VaiTroTaiKhoan } from '../common/db-enums.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PageQueryDto } from '../common/dto/page-query.dto.js';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe.js';
import { DanhMucService } from './danh-muc.service.js';
import { CreateTheLoaiDto, UpdateTheLoaiDto } from './dto/the-loai.dto.js';
import {
  CreateNhaXuatBanDto,
  UpdateNhaXuatBanDto,
} from './dto/nha-xuat-ban.dto.js';
import { CreateTacGiaDto, UpdateTacGiaDto } from './dto/tac-gia.dto.js';

const STAFF = [VaiTroTaiKhoan.ADMIN, VaiTroTaiKhoan.THU_THU];

/** Đọc: mọi người đã đăng nhập. Thêm/sửa: ADMIN/THU_THU. Xóa: chỉ ADMIN (r_qltv_thuthu không có DELETE các bảng này). */
@ApiTags('danh-muc')
@ApiBearerAuth()
@Controller()
export class DanhMucController {
  constructor(private readonly service: DanhMucService) {}

  @Get('the-loai') listTheLoai(@Query() q: PageQueryDto) {
    return this.service.listTheLoai(q);
  }
  @Get('the-loai/:id') getTheLoai(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.getTheLoai(id);
  }
  @Roles(...STAFF) @Post('the-loai') createTheLoai(
    @Body() dto: CreateTheLoaiDto,
  ) {
    return this.service.createTheLoai(dto);
  }
  @Roles(...STAFF) @Patch('the-loai/:id') updateTheLoai(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateTheLoaiDto,
  ) {
    return this.service.updateTheLoai(id, dto);
  }
  @Roles(VaiTroTaiKhoan.ADMIN) @Delete('the-loai/:id') removeTheLoai(
    @Param('id', ParseBigIntPipe) id: bigint,
  ) {
    return this.service.removeTheLoai(id);
  }

  @Get('nha-xuat-ban') listNhaXuatBan(@Query() q: PageQueryDto) {
    return this.service.listNhaXuatBan(q);
  }
  @Get('nha-xuat-ban/:id') getNhaXuatBan(
    @Param('id', ParseBigIntPipe) id: bigint,
  ) {
    return this.service.getNhaXuatBan(id);
  }
  @Roles(...STAFF) @Post('nha-xuat-ban') createNhaXuatBan(
    @Body() dto: CreateNhaXuatBanDto,
  ) {
    return this.service.createNhaXuatBan(dto);
  }
  @Roles(...STAFF) @Patch('nha-xuat-ban/:id') updateNhaXuatBan(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateNhaXuatBanDto,
  ) {
    return this.service.updateNhaXuatBan(id, dto);
  }
  @Roles(VaiTroTaiKhoan.ADMIN) @Delete('nha-xuat-ban/:id') removeNhaXuatBan(
    @Param('id', ParseBigIntPipe) id: bigint,
  ) {
    return this.service.removeNhaXuatBan(id);
  }

  @Get('tac-gia') listTacGia(@Query() q: PageQueryDto) {
    return this.service.listTacGia(q);
  }
  @Get('tac-gia/:id') getTacGia(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.getTacGia(id);
  }
  @Roles(...STAFF) @Post('tac-gia') createTacGia(@Body() dto: CreateTacGiaDto) {
    return this.service.createTacGia(dto);
  }
  @Roles(...STAFF) @Patch('tac-gia/:id') updateTacGia(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateTacGiaDto,
  ) {
    return this.service.updateTacGia(id, dto);
  }
  @Roles(VaiTroTaiKhoan.ADMIN) @Delete('tac-gia/:id') removeTacGia(
    @Param('id', ParseBigIntPipe) id: bigint,
  ) {
    return this.service.removeTacGia(id);
  }
}
