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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VaiTroTaiKhoan } from '../common/db-enums.js';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe.js';
import {
  CapNhatTinhTrangBanSachDto,
  CreateBanSachDto,
  CreateSachDto,
  TraCuuSachQueryDto,
  UpdateSachDto,
} from './dto/sach.dto.js';
import { SachService } from './sach.service.js';

const STAFF = [VaiTroTaiKhoan.ADMIN, VaiTroTaiKhoan.THU_THU];

@ApiTags('sach')
@ApiBearerAuth()
@Controller()
export class SachController {
  constructor(private readonly service: SachService) {}

  @Get('sach')
  traCuu(@Query() q: TraCuuSachQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.traCuu(q, user);
  }

  @Get('sach/:id')
  findOne(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.findOne(id);
  }

  @Roles(...STAFF)
  @Post('sach')
  create(@Body() dto: CreateSachDto) {
    return this.service.create(dto);
  }

  @Roles(...STAFF)
  @Patch('sach/:id')
  update(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: UpdateSachDto) {
    return this.service.update(id, dto);
  }

  @Roles(...STAFF)
  @Delete('sach/:id')
  remove(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.remove(id);
  }

  @Roles(...STAFF)
  @Get('sach/:id/ban-sach')
  listBanSach(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.listBanSach(id);
  }

  @Roles(...STAFF)
  @Post('sach/:id/ban-sach')
  createBanSach(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: CreateBanSachDto,
  ) {
    return this.service.createBanSach(id, dto);
  }

  @Roles(...STAFF)
  @Patch('ban-sach/:maBanSach/tinh-trang')
  capNhatTinhTrang(
    @Param('maBanSach') maBanSach: string,
    @Body() dto: CapNhatTinhTrangBanSachDto,
  ) {
    return this.service.capNhatTinhTrang(maBanSach, dto);
  }
}
