import { Module } from '@nestjs/common';
import { PhatController } from './phat.controller.js';
import { PhatService } from './phat.service.js';

@Module({
  controllers: [PhatController],
  providers: [PhatService],
})
export class PhatModule {}
