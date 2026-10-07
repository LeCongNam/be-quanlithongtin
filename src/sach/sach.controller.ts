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
import {
  CapNhatTinhTrangBanSachDto,
  CreateBanSachDto,
  CreateSachDto,
  TimBanSachQueryDto,
  TraCuuSachQueryDto,
  UpdateSachDto,
} from './dto/sach.dto.js';
import {
  BanSachDto,
  BanSachKemSachDto,
  BanSachMoiDto,
  SachChiTietDto,
  SachCoTacGiaDto,
  SachDto,
  TraCuuSachDto,
} from './dto/sach.response.dto.js';
import { SachService } from './sach.service.js';

const STAFF = [VaiTroTaiKhoan.ADMIN, VaiTroTaiKhoan.THU_THU];

@ApiTags('sach')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404, 409, 422)
@Controller()
export class SachController {
  constructor(private readonly service: SachService) {}

  @Get('sach')
  @ApiOperation({
    summary: 'Tra cứu / danh mục sách',
    description:
      'Có `tuKhoa`: gọi `sp_tra_cuu_sach` (tìm FULLTEXT trên tên và mô tả, ghi nhật ký tra cứu; `% _ \\` hiểu theo nghĩa đen; không phân trang: `page=1`, `limit=total`). Không có `sapXep` thì xếp theo độ liên quan: trùng mã/ISBN, tên sách trùng hẳn, bắt đầu bằng từ khóa, chứa từ khóa, khớp tên tác giả, rồi các sách chỉ khớp mô tả; cùng mức thì theo tên sách). Không có `tuKhoa` (hoặc toàn khoảng trắng): danh mục có phân trang từ `vw_tra_cuu_sach`.',
  })
  @ApiPaginatedResponse(TraCuuSachDto)
  traCuu(@Query() q: TraCuuSachQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.traCuu(q, user);
  }

  @Get('sach/:id')
  @ApiOperation({ summary: 'Chi tiết đầu sách kèm thể loại, NXB, tác giả' })
  @ApiOkResponse({ type: SachChiTietDto })
  findOne(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.findOne(id);
  }

  @Roles(...STAFF)
  @Post('sach')
  @ApiOperation({
    summary: 'Thêm đầu sách',
    description:
      'Qua `sp_them_sach` bằng **mã** (`maTheLoai`, `maNxb`, `maTacGias`). Mã không tồn tại thì không thêm gì và trả 422.',
  })
  @ApiCreatedResponse({ type: SachCoTacGiaDto })
  create(@Body() dto: CreateSachDto) {
    return this.service.create(dto);
  }

  @Roles(...STAFF)
  @Patch('sach/:id')
  @ApiOperation({
    summary: 'Sửa đầu sách',
    description:
      'Gửi `maTacGias` sẽ thay toàn bộ danh sách tác giả của sách. Mã thể loại/NXB/tác giả không tồn tại thì 404.',
  })
  @ApiOkResponse({ type: SachDto })
  update(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: UpdateSachDto) {
    return this.service.update(id, dto);
  }

  @Roles(...STAFF)
  @Delete('sach/:id')
  @ApiOperation({
    summary: 'Xóa đầu sách',
    description: 'Sách đã có bản sách hoặc phiếu tham chiếu thì trả 409.',
  })
  @ApiOkResponse({ type: SachDto, description: 'Bản ghi vừa xóa' })
  remove(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.remove(id);
  }

  @Roles(...STAFF)
  @Get('sach/:id/ban-sach')
  @ApiOperation({ summary: 'Danh sách bản sách của một đầu sách' })
  @ApiOkResponse({ type: [BanSachDto] })
  listBanSach(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.listBanSach(id);
  }

  @Roles(...STAFF)
  @Get('ban-sach')
  @ApiOperation({
    summary: 'Tìm bản sách theo mã hoặc tên sách',
    description:
      'Gợi ý khi lập phiếu mượn: `tuKhoa` khớp một phần mã bản hoặc tên sách, `tinhTrang` lọc (lặp tham số để chọn nhiều), tối đa `limit` dòng (mặc định 10, tối đa 50), xếp theo tên sách rồi mã bản. Không ghi nhật ký tra cứu.',
  })
  @ApiOkResponse({ type: [BanSachKemSachDto] })
  timBanSach(@Query() q: TimBanSachQueryDto) {
    return this.service.timBanSach(q);
  }

  @Roles(...STAFF)
  @Get('ban-sach/:maBanSach')
  @ApiOperation({
    summary: 'Tra một bản sách theo mã',
    description:
      'Trả bản sách kèm mã sách, tên sách và tác giả. Mã không có thì 404; không phân biệt hoa thường.',
  })
  @ApiOkResponse({ type: BanSachKemSachDto })
  findBanSach(@Param('maBanSach') maBanSach: string) {
    return this.service.findBanSach(maBanSach);
  }

  @Roles(...STAFF)
  @Post('sach/:id/ban-sach')
  @ApiOperation({
    summary: 'Nhập bản sách',
    description:
      'Qua `sp_them_ban_sach`: mã `BSnnn` do DB tự sinh, ngày nhập là hôm nay. Nếu đầu sách đang có người chờ đặt trước, bản mới có tình trạng `DANG_GIU`.',
  })
  @ApiCreatedResponse({ type: [BanSachMoiDto] })
  createBanSach(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: CreateBanSachDto,
  ) {
    return this.service.createBanSach(id, dto);
  }

  @Roles(...STAFF)
  @Patch('ban-sach/:maBanSach/tinh-trang')
  @ApiOperation({
    summary: 'Đổi tình trạng bản sách',
    description:
      'Qua `sp_cap_nhat_tinh_trang_ban_sach` (sửa xong, thanh lý, tìm lại...). DB kiểm tra chuyển trạng thái hợp lệ, sai thì 422.',
  })
  @ApiOkResponse({ type: BanSachDto })
  capNhatTinhTrang(
    @Param('maBanSach') maBanSach: string,
    @Body() dto: CapNhatTinhTrangBanSachDto,
  ) {
    return this.service.capNhatTinhTrang(maBanSach, dto);
  }
}
