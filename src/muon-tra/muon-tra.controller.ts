import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
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
import { STAFF_ROLES } from '../common/auth-helpers.js';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ApiErrors } from '../common/swagger/api-errors.decorator.js';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated.decorator.js';
import {
  GiaHanDto,
  ListPhieuMuonQueryDto,
  TaoPhieuMuonDto,
  TraSachDto,
} from './dto/muon-tra.dto.js';
import {
  GiaHanKetQuaDto,
  PhieuMuonChiTietDto,
  TraSachKetQuaDto,
} from './dto/muon-tra.response.dto.js';
import { MuonTraService } from './muon-tra.service.js';

@ApiTags('muon-tra')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404, 422)
@Controller()
export class MuonTraController {
  constructor(private readonly service: MuonTraService) {}

  @Roles(...STAFF_ROLES)
  @Post('phieu-muon')
  @ApiOperation({
    summary: 'Lập phiếu mượn',
    description:
      'Trong một transaction: `sp_tao_phieu_muon` rồi `sp_them_sach_vao_phieu` cho từng bản sách. Một cuốn bị từ chối (đã mượn tối đa số sách cho phép, bản không sẵn sàng, người dùng không đủ điều kiện mượn...) thì không để lại phiếu nào và trả 422 kèm lý do. Cán bộ lập phiếu lấy từ JWT.',
  })
  @ApiCreatedResponse({ type: PhieuMuonChiTietDto })
  taoPhieu(@Body() dto: TaoPhieuMuonDto, @CurrentUser() user: AuthUser) {
    return this.service.taoPhieu(dto, user);
  }

  @Roles(...STAFF_ROLES)
  @Get('phieu-muon')
  @ApiOperation({
    summary:
      'Danh sách phiếu mượn (phân trang, lọc theo trạng thái/người mượn)',
    description: 'Sắp theo ngày mượn mới nhất trước, rồi `id` giảm dần.',
  })
  @ApiPaginatedResponse(PhieuMuonChiTietDto)
  list(@Query() q: ListPhieuMuonQueryDto) {
    return this.service.list(q);
  }

  @Get('phieu-muon/:maPhieu')
  @ApiOperation({
    summary: 'Chi tiết phiếu mượn',
    description:
      'Cán bộ xem được mọi phiếu; bạn đọc chỉ xem phiếu của mình (phiếu của người khác: 403).',
  })
  @ApiOkResponse({ type: PhieuMuonChiTietDto })
  findOne(@Param('maPhieu') maPhieu: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(maPhieu, user);
  }

  @Roles(...STAFF_ROLES)
  @Post('phieu-muon/:maPhieu/huy')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Hủy phiếu mượn',
    description:
      'Qua `sp_huy_phieu_muon`. Phiếu không tồn tại/đã đóng, hoặc đã có sách (hãy trả sách thay vì hủy) thì 422.',
  })
  @ApiOkResponse({ type: PhieuMuonChiTietDto })
  huy(@Param('maPhieu') maPhieu: string) {
    return this.service.huyPhieu(maPhieu);
  }

  @Roles(...STAFF_ROLES)
  @Post('muon-tra/tra')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Trả sách',
    description:
      'Qua `sp_tra_sach`. Trả quá hạn, hư hỏng hoặc mất thì DB tự lập phiếu phạt (xem `phieuPhats` trong kết quả). Bản sách không có lượt mượn đang mở thì 422; `tinhTrang` mặc định `BINH_THUONG`.',
  })
  @ApiOkResponse({ type: TraSachKetQuaDto })
  tra(@Body() dto: TraSachDto) {
    return this.service.traSach(dto);
  }

  @Post('muon-tra/gia-han')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Gia hạn lượt mượn',
    description:
      'Cán bộ: `sp_gia_han` (mọi lượt mượn). Bạn đọc: `sp_gia_han_luot_muon` chỉ cho sách **của mình**; sách của người khác bị báo như không có lượt mượn (422, không phải 403). 422 khi: đã gia hạn tối đa số lần cho phép (tham số `SO_LAN_GIA_HAN_TOI_DA`), sách đã quá hạn, người dùng không hoạt động, hoặc có người đủ điều kiện đang đặt trước sách này.',
  })
  @ApiOkResponse({ type: GiaHanKetQuaDto })
  giaHan(@Body() dto: GiaHanDto, @CurrentUser() user: AuthUser) {
    return this.service.giaHan(dto, user);
  }
}
