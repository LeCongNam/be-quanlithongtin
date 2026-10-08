import { Injectable } from '@nestjs/common';
import { CreateDocgiaDto } from './dto/create-docgia.dto.js';
import { UpdateDocgiaDto } from './dto/update-docgia.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DocgiaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(_createDocgiaDto: CreateDocgiaDto) {
    return this.prisma.$queryRaw`
      /* TODO */
    `;
  }

  findAll() {
    return `This action returns all docgia`;
  }

  findOne(id: number) {
    return `This action returns a #${id} docgia`;
  }

  update(id: number, _updateDocgiaDto: UpdateDocgiaDto) {
    return `This action updates a #${id} docgia`;
  }

  remove(id: number) {
    return `This action removes a #${id} docgia`;
  }
}
