import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateDocgiaDto } from './dto/create-docgia.dto.js';
import { UpdateDocgiaDto } from './dto/update-docgia.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DocgiaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDocgiaDto: CreateDocgiaDto) {
   const docgia = await this.prisma.nguoiDung.create({
        data: {
          maNguoiDung: createDocgiaDto.maNguoiDung,
          hoTen: createDocgiaDto.hoTen,
          loaiNguoiDung: createDocgiaDto.loaiNguoiDung,
          trangThai: createDocgiaDto.trangThai,
          email: createDocgiaDto.email?.trim() || null,
          sdt: createDocgiaDto.sdt?.trim() || null,
          khoaDonVi: createDocgiaDto.khoaDonVi?.trim() || null,
        },
      });

      return {
        ...docgia, 
        id: docgia.id.toString(),

      };
  }

  findAll() {
    return `This action returns all docgia`;
  }

  findOne(id: number) {
    return `This action returns a #${id} docgia`;
  }

  update(id: number, updateDocgiaDto: UpdateDocgiaDto) {
    return `This action updates a #${id} docgia`;
  }

  remove(id: number) {
    return `This action removes a #${id} docgia`;
  }
}
