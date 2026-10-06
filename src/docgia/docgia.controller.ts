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
import { Roles } from '../common/decorators/roles.decorator.js';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe.js';
import { DocgiaService } from './docgia.service.js';
import { CreateDocgiaDto } from './dto/create-docgia.dto.js';
import { CreateTaiKhoanDto } from './dto/create-tai-khoan.dto.js';
import { ListDocgiaQueryDto } from './dto/docgia-query.dto.js';
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

  @Delete(':id')
  remove(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.docgiaService.remove(id);
  }

  @Roles(VaiTroTaiKhoan.ADMIN)
  @Post(':id/tai-khoan')
  taoTaiKhoan(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: CreateTaiKhoanDto,
  ) {
    return this.docgiaService.taoTaiKhoan(id, dto);
  }
}
