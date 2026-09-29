import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DocgiaService } from './docgia.service.js';
import { CreateDocgiaDto } from './dto/create-docgia.dto.js';
import { UpdateDocgiaDto } from './dto/update-docgia.dto.js';

@Controller('docgia')
export class DocgiaController {
  constructor(private readonly docgiaService: DocgiaService) {}

  @Post()
  create(@Body() createDocgiaDto: CreateDocgiaDto) {
    return this.docgiaService.create(createDocgiaDto);
  }

  @Get()
  findAll() {
    return this.docgiaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.docgiaService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDocgiaDto: UpdateDocgiaDto) {
    return this.docgiaService.update(+id, updateDocgiaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.docgiaService.remove(+id);
  }
}
