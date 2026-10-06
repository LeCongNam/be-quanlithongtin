import { Module } from '@nestjs/common';
import { SachController } from './sach.controller.js';
import { SachService } from './sach.service.js';

@Module({
  controllers: [SachController],
  providers: [SachService],
})
export class SachModule {}
