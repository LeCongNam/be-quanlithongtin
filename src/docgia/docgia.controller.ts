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
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe.js';
import { ApiErrors } from '../common/swagger/api-errors.decorator.js';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated.decorator.js';
import { DocgiaService } from './docgia.service.js';
import { CreateDocgiaDto } from './dto/create-docgia.dto.js';
import { CreateTaiKhoanDto } from './dto/create-tai-khoan.dto.js';
import { ListDocgiaQueryDto } from './dto/docgia-query.dto.js';
import {
  NguoiDungChiTietDto,
  NguoiDungDto,
  TaiKhoanCongKhaiDto,
} from './dto/docgia.response.dto.js';
import {
  DoiTrangThaiNguoiDungDto,
  DoiTrangThaiTaiKhoanDto,
} from './dto/trang-thai.dto.js';
import { UpdateDocgiaDto } from './dto/update-docgia.dto.js';

@ApiTags('docgia')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404, 409, 422)
@Roles(VaiTroTaiKhoan.ADMIN, VaiTroTaiKhoan.THU_THU)
@Controller('docgia')
export class DocgiaController {
  constructor(private readonly docgiaService: DocgiaService) {}

  @Post()
  @ApiOperation({
    summary: 'Thêm người dùng (bạn đọc hoặc cán bộ)',
    description:
      'Người mới luôn `HOAT_DONG` (không nhận `trangThai`). Tạo tài khoản đăng nhập riêng ở `POST /docgia/{id}/tai-khoan`.',
  })
  @ApiCreatedResponse({ type: NguoiDungDto })
  create(@Body() createDocgiaDto: CreateDocgiaDto) {
    return this.docgiaService.create(createDocgiaDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách người dùng (phân trang, lọc, tìm theo từ khóa)',
  })
  @ApiPaginatedResponse(NguoiDungDto)
  findAll(@Query() query: ListDocgiaQueryDto) {
    return this.docgiaService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết người dùng kèm tài khoản',
    description: '`taiKhoan` không bao giờ chứa muối hay hash mật khẩu.',
  })
  @ApiOkResponse({ type: NguoiDungChiTietDto })
  findOne(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.docgiaService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Sửa thông tin người dùng',
    description:
      'Không đổi trạng thái ở đây; dùng `PATCH /docgia/{id}/trang-thai`.',
  })
  @ApiOkResponse({ type: NguoiDungDto })
  update(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() updateDocgiaDto: UpdateDocgiaDto,
  ) {
    return this.docgiaService.update(id, updateDocgiaDto);
  }

  @Patch(':id/trang-thai')
  @ApiOperation({
    summary: 'Đổi trạng thái người dùng',
    description:
      'Bạn đọc: qua `sp_doi_trang_thai_nguoi_dung`. Cán bộ: chỉ ADMIN (THU_THU nhận 403). Khi người dùng rời `HOAT_DONG`, tài khoản tự bị `KHOA`; quay lại `HOAT_DONG` thì tài khoản **vẫn KHOA**, ADMIN phải mở riêng ở `/tai-khoan/trang-thai`. Đổi sang trạng thái đang có thì 422.',
  })
  @ApiOkResponse({ type: NguoiDungChiTietDto })
  doiTrangThai(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() { trangThai }: DoiTrangThaiNguoiDungDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.docgiaService.doiTrangThai(id, trangThai, user);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Ngừng người dùng (không xóa cứng)',
    description:
      'Chuyển người dùng sang `NGUNG` (cùng luồng như đổi trạng thái); cán bộ chỉ ADMIN làm được.',
  })
  @ApiOkResponse({ type: NguoiDungChiTietDto })
  remove(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.docgiaService.remove(id, user);
  }

  @Roles(VaiTroTaiKhoan.ADMIN)
  @Post(':id/tai-khoan')
  @ApiOperation({
    summary: 'Tạo tài khoản đăng nhập cho người dùng',
    description:
      'Mặc định `tenDangNhap` = mã người dùng viết thường; `vaiTro` mặc định THU_THU cho CAN_BO, BAN_DOC cho còn lại (DB bắt buộc vai trò khớp loại người dùng). Đã có tài khoản thì 409.',
  })
  @ApiCreatedResponse({ type: TaiKhoanCongKhaiDto })
  taoTaiKhoan(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: CreateTaiKhoanDto,
  ) {
    return this.docgiaService.taoTaiKhoan(id, dto);
  }

  @Roles(VaiTroTaiKhoan.ADMIN)
  @Patch(':id/tai-khoan/trang-thai')
  @ApiOperation({
    summary: 'Khóa/mở tài khoản đăng nhập',
    description:
      'Mở tài khoản khi người dùng chưa `HOAT_DONG` thì 422 (trigger của DB).',
  })
  @ApiOkResponse({ type: TaiKhoanCongKhaiDto })
  doiTrangThaiTaiKhoan(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() { trangThai }: DoiTrangThaiTaiKhoanDto,
  ) {
    return this.docgiaService.doiTrangThaiTaiKhoan(id, trangThai);
  }
}
