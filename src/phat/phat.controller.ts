import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { STAFF_ROLES } from '../common/auth-helpers.js';
import { VaiTroTaiKhoan } from '../common/db-enums.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe.js';
import { HuyPhatDto, ListPhatQueryDto } from './dto/phat.dto.js';
import { PhatService } from './phat.service.js';

@ApiTags('phat')
@ApiBearerAuth()
@Controller('phat')
export class PhatController {
  constructor(private readonly service: PhatService) {}

  @Roles(...STAFF_ROLES)
  @Get()
  list(@Query() q: ListPhatQueryDto) {
    return this.service.list(q);
  }

  @Roles(...STAFF_ROLES)
  @Post(':id/thanh-toan')
  @HttpCode(200)
  thanhToan(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.thanhToan(id);
  }

  @Roles(VaiTroTaiKhoan.ADMIN)
  @Post(':id/huy')
  @HttpCode(200)
  huy(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: HuyPhatDto) {
    return this.service.huy(id, dto.lyDo);
  }
}
