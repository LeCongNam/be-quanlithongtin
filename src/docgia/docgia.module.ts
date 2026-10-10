import { Module } from '@nestjs/common';
import { DocgiaService } from './docgia.service.js';
import { DocgiaController } from './docgia.controller.js';

@Module({
  controllers: [DocgiaController],
  providers: [DocgiaService],
})
export class DocgiaModule {}
