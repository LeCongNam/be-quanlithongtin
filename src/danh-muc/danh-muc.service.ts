import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PageQueryDto,
  paginate,
  skipTake,
} from '../common/dto/page-query.dto.js';
import { CreateTheLoaiDto, UpdateTheLoaiDto } from './dto/the-loai.dto.js';
import {
  CreateNhaXuatBanDto,
  UpdateNhaXuatBanDto,
} from './dto/nha-xuat-ban.dto.js';
import { CreateTacGiaDto, UpdateTacGiaDto } from './dto/tac-gia.dto.js';

/** CRUD cho 3 danh mục: thể loại, nhà xuất bản, tác giả. Xóa bản ghi đang được sách dùng -> 409 (FK). */
@Injectable()
export class DanhMucService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Thể loại
  async listTheLoai(q: PageQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.theLoai.findMany({
        orderBy: [{ tenTheLoai: 'asc' }, { id: 'asc' }],
        ...skipTake(q),
      }),
      this.prisma.theLoai.count(),
    ]);
    return paginate(data, total, q);
  }
  async getTheLoai(id: bigint) {
    return this.found(
      await this.prisma.theLoai.findUnique({ where: { id } }),
      'the loai',
    );
  }
  createTheLoai(data: CreateTheLoaiDto) {
    return this.prisma.theLoai.create({ data });
  }
  updateTheLoai(id: bigint, data: UpdateTheLoaiDto) {
    return this.prisma.theLoai.update({ where: { id }, data });
  }
  removeTheLoai(id: bigint) {
    return this.prisma.theLoai.delete({ where: { id } });
  }

  // ---- Nhà xuất bản
  async listNhaXuatBan(q: PageQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.nhaXuatBan.findMany({
        orderBy: [{ tenNxb: 'asc' }, { id: 'asc' }],
        ...skipTake(q),
      }),
      this.prisma.nhaXuatBan.count(),
    ]);
    return paginate(data, total, q);
  }
  async getNhaXuatBan(id: bigint) {
    return this.found(
      await this.prisma.nhaXuatBan.findUnique({ where: { id } }),
      'nha xuat ban',
    );
  }
  createNhaXuatBan(data: CreateNhaXuatBanDto) {
    return this.prisma.nhaXuatBan.create({ data });
  }
  updateNhaXuatBan(id: bigint, data: UpdateNhaXuatBanDto) {
    return this.prisma.nhaXuatBan.update({ where: { id }, data });
  }
  removeNhaXuatBan(id: bigint) {
    return this.prisma.nhaXuatBan.delete({ where: { id } });
  }

  // ---- Tác giả
  async listTacGia(q: PageQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.tacGia.findMany({
        orderBy: [{ tenTacGia: 'asc' }, { id: 'asc' }],
        ...skipTake(q),
      }),
      this.prisma.tacGia.count(),
    ]);
    return paginate(data, total, q);
  }
  async getTacGia(id: bigint) {
    return this.found(
      await this.prisma.tacGia.findUnique({ where: { id } }),
      'tac gia',
    );
  }
  createTacGia(data: CreateTacGiaDto) {
    return this.prisma.tacGia.create({ data });
  }
  updateTacGia(id: bigint, data: UpdateTacGiaDto) {
    return this.prisma.tacGia.update({ where: { id }, data });
  }
  removeTacGia(id: bigint) {
    return this.prisma.tacGia.delete({ where: { id } });
  }

  private found<T>(row: T | null, what: string): T {
    if (!row) throw new NotFoundException(`Khong tim thay ${what}`);
    return row;
  }
}
