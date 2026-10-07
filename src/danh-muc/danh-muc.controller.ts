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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { VaiTroTaiKhoan } from '../common/db-enums.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PageQueryDto } from '../common/dto/page-query.dto.js';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe.js';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated.decorator.js';
import { ApiErrors } from '../common/swagger/api-errors.decorator.js';
import { DanhMucService } from './danh-muc.service.js';
import {
  NhaXuatBanDto,
  TacGiaDto,
  TheLoaiDto,
} from './dto/danh-muc.response.dto.js';
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
@ApiErrors(400, 401, 403, 404, 409)
@Controller()
export class DanhMucController {
  constructor(private readonly service: DanhMucService) {}

  // ---- Thể loại
  @Get('the-loai')
  @ApiOperation({ summary: 'Danh sách thể loại (phân trang, theo tên)' })
  @ApiPaginatedResponse(TheLoaiDto)
  listTheLoai(@Query() q: PageQueryDto) {
    return this.service.listTheLoai(q);
  }

  @Get('the-loai/:id')
  @ApiOperation({ summary: 'Chi tiết thể loại' })
  @ApiOkResponse({ type: TheLoaiDto })
  getTheLoai(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.getTheLoai(id);
  }

  @Roles(...STAFF)
  @Post('the-loai')
  @ApiOperation({ summary: 'Thêm thể loại' })
  @ApiCreatedResponse({ type: TheLoaiDto })
  createTheLoai(@Body() dto: CreateTheLoaiDto) {
    return this.service.createTheLoai(dto);
  }

  @Roles(...STAFF)
  @Patch('the-loai/:id')
  @ApiOperation({ summary: 'Sửa thể loại' })
  @ApiOkResponse({ type: TheLoaiDto })
  updateTheLoai(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateTheLoaiDto,
  ) {
    return this.service.updateTheLoai(id, dto);
  }

  @Roles(VaiTroTaiKhoan.ADMIN)
  @Delete('the-loai/:id')
  @ApiOperation({
    summary: 'Xóa thể loại',
    description: 'Thể loại đang có sách thì trả 409 (khóa ngoại).',
  })
  @ApiOkResponse({ type: TheLoaiDto, description: 'Bản ghi vừa xóa' })
  removeTheLoai(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.removeTheLoai(id);
  }

  // ---- Nhà xuất bản
  @Get('nha-xuat-ban')
  @ApiOperation({ summary: 'Danh sách nhà xuất bản (phân trang)' })
  @ApiPaginatedResponse(NhaXuatBanDto)
  listNhaXuatBan(@Query() q: PageQueryDto) {
    return this.service.listNhaXuatBan(q);
  }

  @Get('nha-xuat-ban/:id')
  @ApiOperation({ summary: 'Chi tiết nhà xuất bản' })
  @ApiOkResponse({ type: NhaXuatBanDto })
  getNhaXuatBan(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.getNhaXuatBan(id);
  }

  @Roles(...STAFF)
  @Post('nha-xuat-ban')
  @ApiOperation({ summary: 'Thêm nhà xuất bản' })
  @ApiCreatedResponse({ type: NhaXuatBanDto })
  createNhaXuatBan(@Body() dto: CreateNhaXuatBanDto) {
    return this.service.createNhaXuatBan(dto);
  }

  @Roles(...STAFF)
  @Patch('nha-xuat-ban/:id')
  @ApiOperation({ summary: 'Sửa nhà xuất bản' })
  @ApiOkResponse({ type: NhaXuatBanDto })
  updateNhaXuatBan(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateNhaXuatBanDto,
  ) {
    return this.service.updateNhaXuatBan(id, dto);
  }

  @Roles(VaiTroTaiKhoan.ADMIN)
  @Delete('nha-xuat-ban/:id')
  @ApiOperation({
    summary: 'Xóa nhà xuất bản',
    description: 'NXB đang có sách thì trả 409 (khóa ngoại).',
  })
  @ApiOkResponse({ type: NhaXuatBanDto, description: 'Bản ghi vừa xóa' })
  removeNhaXuatBan(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.removeNhaXuatBan(id);
  }

  // ---- Tác giả
  @Get('tac-gia')
  @ApiOperation({ summary: 'Danh sách tác giả (phân trang)' })
  @ApiPaginatedResponse(TacGiaDto)
  listTacGia(@Query() q: PageQueryDto) {
    return this.service.listTacGia(q);
  }

  @Get('tac-gia/:id')
  @ApiOperation({ summary: 'Chi tiết tác giả' })
  @ApiOkResponse({ type: TacGiaDto })
  getTacGia(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.getTacGia(id);
  }

  @Roles(...STAFF)
  @Post('tac-gia')
  @ApiOperation({ summary: 'Thêm tác giả' })
  @ApiCreatedResponse({ type: TacGiaDto })
  createTacGia(@Body() dto: CreateTacGiaDto) {
    return this.service.createTacGia(dto);
  }

  @Roles(...STAFF)
  @Patch('tac-gia/:id')
  @ApiOperation({ summary: 'Sửa tác giả' })
  @ApiOkResponse({ type: TacGiaDto })
  updateTacGia(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateTacGiaDto,
  ) {
    return this.service.updateTacGia(id, dto);
  }

  @Roles(VaiTroTaiKhoan.ADMIN)
  @Delete('tac-gia/:id')
  @ApiOperation({
    summary: 'Xóa tác giả',
    description: 'Tác giả đang gắn với sách thì trả 409 (khóa ngoại).',
  })
  @ApiOkResponse({ type: TacGiaDto, description: 'Bản ghi vừa xóa' })
  removeTacGia(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.removeTacGia(id);
  }
}
