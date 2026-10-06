import { Module } from '@nestjs/common';
import { MuonTraController } from './muon-tra.controller.js';
import { MuonTraService } from './muon-tra.service.js';

@Module({
  controllers: [MuonTraController],
  providers: [MuonTraService],
})
export class MuonTraModule {}
