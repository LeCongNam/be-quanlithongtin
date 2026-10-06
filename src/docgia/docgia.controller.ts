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
import { DocgiaService } from './docgia.service.js';
import { CreateDocgiaDto } from './dto/create-docgia.dto.js';
import { CreateTaiKhoanDto } from './dto/create-tai-khoan.dto.js';
import { ListDocgiaQueryDto } from './dto/docgia-query.dto.js';
import {
  DoiTrangThaiNguoiDungDto,
  DoiTrangThaiTaiKhoanDto,
} from './dto/trang-thai.dto.js';
import { UpdateDocgiaDto } from './dto/update-docgia.dto.js';

@ApiTags('docgia')
@ApiBearerAuth()
@Roles(VaiTroTaiKhoan.ADMIN, VaiTroTaiKhoan.THU_THU)
@Controller('docgia')
export class DocgiaController {
  constructor(private readonly docgiaService: DocgiaService) {}

  @Post()
  create(@Body() createDocgiaDto: CreateDocgiaDto) {
    return this.docgiaService.create(createDocgiaDto);
  }

  @Get()
  findAll(@Query() query: ListDocgiaQueryDto) {
    return this.docgiaService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.docgiaService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() updateDocgiaDto: UpdateDocgiaDto,
  ) {
    return this.docgiaService.update(id, updateDocgiaDto);
  }

  @Patch(':id/trang-thai')
  doiTrangThai(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() { trangThai }: DoiTrangThaiNguoiDungDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.docgiaService.doiTrangThai(id, trangThai, user);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.docgiaService.remove(id, user);
  }

  @Roles(VaiTroTaiKhoan.ADMIN)
  @Post(':id/tai-khoan')
  taoTaiKhoan(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: CreateTaiKhoanDto,
  ) {
    return this.docgiaService.taoTaiKhoan(id, dto);
  }

  @Roles(VaiTroTaiKhoan.ADMIN)
  @Patch(':id/tai-khoan/trang-thai')
  doiTrangThaiTaiKhoan(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() { trangThai }: DoiTrangThaiTaiKhoanDto,
  ) {
    return this.docgiaService.doiTrangThaiTaiKhoan(id, trangThai);
  }
}
