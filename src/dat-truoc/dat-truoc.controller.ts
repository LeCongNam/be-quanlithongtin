import {
  Body,
  Controller,
  Delete,
  Get,
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
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { ApiErrors } from '../common/swagger/api-errors.decorator.js';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated.decorator.js';
import { DatTruocService } from './dat-truoc.service.js';
import {
  DatTruocDto,
  HuyDatTruocQueryDto,
  ListDatTruocQueryDto,
} from './dto/dat-truoc.dto.js';
import {
  DatTruocDto as DatTruocResponseDto,
  HuyDatTruocKetQuaDto,
} from './dto/dat-truoc.response.dto.js';

@ApiTags('dat-truoc')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 422)
@Controller('dat-truoc')
export class DatTruocController {
  constructor(private readonly service: DatTruocService) {}

  @Post()
  @ApiOperation({
    summary: 'Đặt trước đầu sách',
    description:
      'Qua `sp_dat_truoc`. Bạn đọc đặt cho chính mình (bỏ `maNguoiDung`, nếu gửi mã người khác thì 403). Cán bộ đặt hộ thì phải gửi `maNguoiDung` (thiếu: 400). 422 khi: còn bản sách sẵn sàng (không cần đặt), đang mượn chính đầu sách đó, hoặc không đủ điều kiện đặt (người dùng không hoạt động, đang giữ sách quá hạn, còn nợ phạt, đã đặt rồi...).',
  })
  @ApiCreatedResponse({ type: DatTruocResponseDto })
  datTruoc(@Body() dto: DatTruocDto, @CurrentUser() user: AuthUser) {
    return this.service.datTruoc(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách lượt đặt trước',
    description:
      'Bạn đọc luôn chỉ thấy lượt của mình (bỏ qua `maNguoiDung`). Cán bộ thấy tất cả và lọc được theo `maNguoiDung`.',
  })
  @ApiPaginatedResponse(DatTruocResponseDto)
  list(@Query() q: ListDatTruocQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.list(q, user);
  }

  @Delete(':maSach')
  @ApiOperation({
    summary: 'Hủy đặt trước',
    description:
      'Qua `sp_huy_dat_truoc`. Bạn đọc hủy lượt của mình; cán bộ hủy hộ thì phải gửi query `maNguoiDung`.',
  })
  @ApiOkResponse({ type: HuyDatTruocKetQuaDto })
  huy(
    @Param('maSach') maSach: string,
    @Query() q: HuyDatTruocQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.huyDatTruoc(maSach, user, q.maNguoiDung);
  }
}
