import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { DocgiaModule } from './docgia/docgia.module.js';
import { SachModule } from './sach/sach.module.js';
import { TheLoaiModule } from './the-loai/the-loai.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    DocgiaModule,
    SachModule,
    TheLoaiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
