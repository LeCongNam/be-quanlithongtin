import { Module } from '@nestjs/common';
import { SachService } from './sach.service.js';
import { SachController } from './sach.controller.js';

@Module({
  controllers: [SachController],
  providers: [SachService],
})
export class SachModule {}
