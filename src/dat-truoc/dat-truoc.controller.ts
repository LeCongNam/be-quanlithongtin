import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { DatTruocService } from './dat-truoc.service.js';
import {
  DatTruocDto,
  HuyDatTruocQueryDto,
  ListDatTruocQueryDto,
} from './dto/dat-truoc.dto.js';

@ApiTags('dat-truoc')
@ApiBearerAuth()
@Controller('dat-truoc')
export class DatTruocController {
  constructor(private readonly service: DatTruocService) {}

  @Post()
  datTruoc(@Body() dto: DatTruocDto, @CurrentUser() user: AuthUser) {
    return this.service.datTruoc(dto, user);
  }

  @Get()
  list(@Query() q: ListDatTruocQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.list(q, user);
  }

  @Delete(':maSach')
  huy(
    @Param('maSach') maSach: string,
    @Query() q: HuyDatTruocQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.huyDatTruoc(maSach, user, q.maNguoiDung);
  }
}
