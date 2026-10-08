import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTheLoaiDto } from './dto/create-the-loai.dto.js';
import { UpdateTheLoaiDto } from './dto/update-the-loai.dto.js';

@Injectable()
export class TheLoaiService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTheLoaiDto: CreateTheLoaiDto) {
    await this.prisma.$queryRaw`
      INSERT INTO the_loai (ma_the_loai, ten_the_loai, mo_ta)
      VALUES (${createTheLoaiDto.ma_the_loai}, ${createTheLoaiDto.ten_the_loai}, ${createTheLoaiDto.mo_ta ?? null})
    `;

    return this.prisma.$queryRaw`
      SELECT *
      FROM the_loai
      WHERE id = LAST_INSERT_ID()
    `;
  }

  findAll() {
    return this.prisma.$queryRaw`
      SELECT *
      FROM the_loai
      ORDER BY id ASC
    `;
  }

  findOne(id: number) {
    return this.prisma.$queryRaw`
      SELECT *
      FROM the_loai
      WHERE id = ${id}
    `;
  }

  async update(id: number, updateTheLoaiDto: UpdateTheLoaiDto) {
    await this.prisma.$queryRaw`
      UPDATE the_loai
      SET ma_the_loai = COALESCE(${updateTheLoaiDto.ma_the_loai ?? null}, ma_the_loai),
          ten_the_loai = COALESCE(${updateTheLoaiDto.ten_the_loai ?? null}, ten_the_loai),
          mo_ta = COALESCE(${updateTheLoaiDto.mo_ta ?? null}, mo_ta)
      WHERE id = ${id}
    `;

    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.prisma.$queryRaw`
      SELECT *
      FROM the_loai
      WHERE id = ${id}
    `;

    if (!Array.isArray(existing) || existing.length === 0) {
      return null;
    }

    await this.prisma.$queryRaw`
      DELETE FROM the_loai
      WHERE id = ${id}
    `;

    return existing[0];
  }
}
