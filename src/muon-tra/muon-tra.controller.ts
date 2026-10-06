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
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  GiaHanDto,
  ListPhieuMuonQueryDto,
  TaoPhieuMuonDto,
  TraSachDto,
} from './dto/muon-tra.dto.js';
import { MuonTraService } from './muon-tra.service.js';

@ApiTags('muon-tra')
@ApiBearerAuth()
@Controller()
export class MuonTraController {
  constructor(private readonly service: MuonTraService) {}

  @Roles(...STAFF_ROLES)
  @Post('phieu-muon')
  taoPhieu(@Body() dto: TaoPhieuMuonDto, @CurrentUser() user: AuthUser) {
    return this.service.taoPhieu(dto, user);
  }

  @Roles(...STAFF_ROLES)
  @Get('phieu-muon')
  list(@Query() q: ListPhieuMuonQueryDto) {
    return this.service.list(q);
  }

  @Get('phieu-muon/:maPhieu')
  findOne(@Param('maPhieu') maPhieu: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(maPhieu, user);
  }

  @Roles(...STAFF_ROLES)
  @Post('phieu-muon/:maPhieu/huy')
  @HttpCode(200)
  huy(@Param('maPhieu') maPhieu: string) {
    return this.service.huyPhieu(maPhieu);
  }

  @Roles(...STAFF_ROLES)
  @Post('muon-tra/tra')
  @HttpCode(200)
  tra(@Body() dto: TraSachDto) {
    return this.service.traSach(dto);
  }

  @Post('muon-tra/gia-han')
  @HttpCode(200)
  giaHan(@Body() dto: GiaHanDto, @CurrentUser() user: AuthUser) {
    return this.service.giaHan(dto, user);
  }
}
