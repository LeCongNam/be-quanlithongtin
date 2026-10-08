import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ShowParamDto } from '../common/dto/show-param.dto.js';
import { CreateTheLoaiDto } from './dto/create-the-loai.dto.js';
import { UpdateTheLoaiDto } from './dto/update-the-loai.dto.js';
import { TheLoaiService } from './the-loai.service.js';

@Controller('the-loai')
@ApiTags('Thể loại')
export class TheLoaiController {
  constructor(private readonly theLoaiService: TheLoaiService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo thể loại' })
  create(@Body() createTheLoaiDto: CreateTheLoaiDto) {
    return this.theLoaiService.create(createTheLoaiDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách thể loại' })
  findAll() {
    return this.theLoaiService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin thể loại theo ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID thể loại', example: 1 })
  findOne(@Param() params: ShowParamDto) {
    return this.theLoaiService.findOne(params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thể loại' })
  @ApiParam({ name: 'id', type: Number, description: 'ID thể loại', example: 1 })
  update(@Param() params: ShowParamDto, @Body() updateTheLoaiDto: UpdateTheLoaiDto) {
    return this.theLoaiService.update(params.id, updateTheLoaiDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa thể loại' })
  @ApiParam({ name: 'id', type: Number, description: 'ID thể loại', example: 1 })
  remove(@Param() params: ShowParamDto) {
    return this.theLoaiService.remove(params.id);
  }
}
