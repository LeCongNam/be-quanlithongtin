import { Module } from '@nestjs/common';
import { DocgiaService } from './docgia.service.js';
import { DocgiaController } from './docgia.controller.js';

@Module({
  imports: [],
  controllers: [DocgiaController],
  providers: [DocgiaService],
})
export class DocgiaModule {}
