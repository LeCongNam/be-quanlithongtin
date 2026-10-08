import { Injectable } from '@nestjs/common';
import { CreateSachDto } from './dto/create-sach.dto.js';
import { UpdateSachDto } from './dto/update-sach.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SachService {

  constructor(
    private readonly prisma: PrismaService
  ) { }

  create(_createSachDto: CreateSachDto) {
    return this.prisma.$queryRaw`
    insert into sach (ma_sach, isbn, ten_sach, the_loai_id, nxb_id, nam_xuat_ban, ngon_ngu, mo_ta)
    values (${_createSachDto.ma_sach}, ${_createSachDto.isbn}, ${_createSachDto.ten_sach}, ${_createSachDto.the_loai_id}, ${_createSachDto.nxb_id}, ${_createSachDto.nam_xuat_ban}, ${_createSachDto.ngon_ngu}, ${_createSachDto.mo_ta})
    `;

  }

  async findAll() {
    const data = await this.prisma.$queryRaw`
      select * 
     from sach
    `;

    return data;
  }

  findOne(_id: number) {
    return this.prisma.$queryRaw`
      /* TODO */
    `;
  }

  update(_id: number, _updateSachDto: UpdateSachDto) {
    return this.prisma.$queryRaw`
      /* TODO */
    `;
  }

  remove(_id: number) {
    return this.prisma.$queryRaw`
      /* TODO */
    `;
  }
}
