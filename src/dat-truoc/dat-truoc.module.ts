import { Module } from '@nestjs/common';
import { DatTruocController } from './dat-truoc.controller.js';
import { DatTruocService } from './dat-truoc.service.js';

@Module({
  controllers: [DatTruocController],
  providers: [DatTruocService],
})
export class DatTruocModule {}
