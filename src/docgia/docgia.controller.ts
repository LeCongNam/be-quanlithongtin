import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ShowParamDto } from '../common/dto/show-param.dto.js';
import { DocgiaService } from './docgia.service.js';
import { CreateDocgiaDto } from './dto/create-docgia.dto.js';
import { UpdateDocgiaDto } from './dto/update-docgia.dto.js';

@Controller('docgia')
@ApiTags('Độc giả')
export class DocgiaController {
  constructor(private readonly docgiaService: DocgiaService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo độc giả' })
  create(@Body() createDocgiaDto: CreateDocgiaDto) {
    return this.docgiaService.create(createDocgiaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách độc giả' })
  findAll() {
    return this.docgiaService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin độc giả theo ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID độc giả', example: 1 })
  findOne(@Param() params: ShowParamDto) {
    return this.docgiaService.findOne(params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật độc giả' })
  @ApiParam({ name: 'id', type: Number, description: 'ID độc giả', example: 1 })
  update(@Param() params: ShowParamDto, @Body() updateDocgiaDto: UpdateDocgiaDto) {
    return this.docgiaService.update(params.id, updateDocgiaDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa độc giả' })
  @ApiParam({ name: 'id', type: Number, description: 'ID độc giả', example: 1 })
  remove(@Param() params: ShowParamDto) {
    return this.docgiaService.remove(params.id);
  }
}
