import { Module } from '@nestjs/common';
import { TheLoaiController } from './the-loai.controller.js';
import { TheLoaiService } from './the-loai.service.js';

@Module({
  controllers: [TheLoaiController],
  providers: [TheLoaiService],
})
export class TheLoaiModule {}
