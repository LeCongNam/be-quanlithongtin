import { Module } from '@nestjs/common';
import { DocgiaService } from './docgia.service.js';
import { DocgiaController } from './docgia.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [DocgiaController],
  providers: [DocgiaService],
})
export class DocgiaModule {}
