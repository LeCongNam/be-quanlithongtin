import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { STAFF_ROLES } from '../common/auth-helpers.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ApiErrors } from '../common/swagger/api-errors.decorator.js';
import { DemoService } from './demo.service.js';
import { DemoChayDto, DemoThamSoDto } from './dto/demo.dto.js';
import {
  DemoBangLienQuanDto,
  DemoChiTietDto,
  DemoKetQuaDto,
  DemoMucDto,
} from './dto/demo.response.dto.js';

@ApiTags('demo')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404)
@Roles(...STAFF_ROLES)
@Controller('demo')
export class DemoController {
  constructor(private readonly service: DemoService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách mục demo (Procedure, Trigger, Function, Cursor)',
    description:
      'Mỗi mục có bài toán (bước 1); chi tiết, câu SQL, bảng liên quan và nút chạy ở các endpoint bên dưới.',
  })
  @ApiOkResponse({ type: [DemoMucDto] })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết một mục demo: câu SQL (bước 2), tham số, câu lệnh thực thi (bước 4)',
    description:
      'Câu SQL của procedure/function đọc từ CSDL bằng `SHOW CREATE`; trigger đọc từ `sql/05_triggers.sql` vì user `qltt` không có quyền TRIGGER. Gợi ý tham số lấy từ dữ liệu hiện có.',
  })
  @ApiOkResponse({ type: DemoChiTietDto })
  chiTiet(@Param('id') id: string) {
    return this.service.chiTiet(id);
  }

  @Post(':id/bang')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Các bảng liên quan trước khi chạy (bước 3)',
    description: 'Chỉ đọc; dữ liệu truy vấn trực tiếp từ CSDL theo tham số.',
  })
  @ApiOkResponse({ type: DemoBangLienQuanDto })
  bang(@Param('id') id: string, @Body() dto: DemoThamSoDto) {
    return this.service.bang(id, dto.thamSo);
  }

  @Post(':id/chay')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Thực thi và xem lại các bảng liên quan (bước 4 và 5)',
    description:
      'Chạy trong transaction; `hoanTac = true` (mặc định) thì ROLLBACK sau khi đọc lại bảng nên dữ liệu không đổi. Lỗi nghiệp vụ của procedure/trigger không trả 422 mà nằm trong `loi` (kèm bảng sau khi chạy) để trình bày; tham số sai trả 400.',
  })
  @ApiOkResponse({ type: DemoKetQuaDto })
  chay(@Param('id') id: string, @Body() dto: DemoChayDto) {
    return this.service.chay(id, dto.thamSo, dto.hoanTac);
  }
}
