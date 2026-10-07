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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { STAFF_ROLES } from '../common/auth-helpers.js';
import { VaiTroTaiKhoan } from '../common/db-enums.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe.js';
import { ApiErrors } from '../common/swagger/api-errors.decorator.js';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated.decorator.js';
import { HuyPhatDto, ListPhatQueryDto } from './dto/phat.dto.js';
import { PhieuPhatChiTietDto, PhieuPhatDto } from './dto/phat.response.dto.js';
import { PhatService } from './phat.service.js';

@ApiTags('phat')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404, 422)
@Controller('phat')
export class PhatController {
  constructor(private readonly service: PhatService) {}

  @Roles(...STAFF_ROLES)
  @Get()
  @ApiOperation({
    summary:
      'Danh sách phiếu phạt (phân trang, lọc theo trạng thái/người dùng)',
    description:
      'Phiếu phạt do DB tự lập khi trả sách quá hạn/hư hỏng/mất. Bạn đọc xem phạt của mình ở `GET /me/tien-phat`. Phiếu `CHUA_THANH_TOAN` đứng trước, rồi các phiếu còn lại; mỗi nhóm sắp theo ngày tạo mới nhất trước.',
  })
  @ApiPaginatedResponse(PhieuPhatChiTietDto)
  list(@Query() q: ListPhatQueryDto) {
    return this.service.list(q);
  }

  @Roles(...STAFF_ROLES)
  @Post(':id/thanh-toan')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Thanh toán phiếu phạt',
    description:
      'Qua `sp_thanh_toan_phat`. Phiếu không tồn tại hoặc không ở trạng thái `CHUA_THANH_TOAN` thì 422.',
  })
  @ApiOkResponse({ type: PhieuPhatDto })
  thanhToan(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.thanhToan(id);
  }

  @Roles(VaiTroTaiKhoan.ADMIN)
  @Post(':id/huy')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Hủy phiếu phạt',
    description:
      'Qua `sp_huy_phat` (bắt buộc ghi lý do). Chỉ ADMIN; phiếu không ở trạng thái `CHUA_THANH_TOAN` thì 422.',
  })
  @ApiOkResponse({ type: PhieuPhatDto })
  huy(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: HuyPhatDto) {
    return this.service.huy(id, dto.lyDo);
  }
}
