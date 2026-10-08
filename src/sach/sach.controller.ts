import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ShowParamDto } from '../common/dto/show-param.dto.js';
import { SachService } from './sach.service.js';
import { CreateSachDto } from './dto/create-sach.dto.js';
import { UpdateSachDto } from './dto/update-sach.dto.js';

@Controller('sach')
@ApiTags('Sách')
export class SachController {
  constructor(private readonly sachService: SachService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo sách' })
  create(@Body() createSachDto: CreateSachDto) {
    return this.sachService.create(createSachDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách sách' })
  findAll() {
    return this.sachService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin sách theo ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID sách', example: 1 })
  findOne(@Param() params: ShowParamDto) {
    return this.sachService.findOne(params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật sách' })
  @ApiParam({ name: 'id', type: Number, description: 'ID sách', example: 1 })
  update(@Param() params: ShowParamDto, @Body() updateSachDto: UpdateSachDto) {
    return this.sachService.update(params.id, updateSachDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa sách' })
  @ApiParam({ name: 'id', type: Number, description: 'ID sách', example: 1 })
  remove(@Param() params: ShowParamDto) {
    return this.sachService.remove(params.id);
  }
}


