import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { DocgiaModule } from './docgia/docgia.module.js';
import { DanhMucModule } from './danh-muc/danh-muc.module.js';
import { SachModule } from './sach/sach.module.js';
import { MuonTraModule } from './muon-tra/muon-tra.module.js';
import { DatTruocModule } from './dat-truoc/dat-truoc.module.js';
import { PhatModule } from './phat/phat.module.js';
import { BanDocModule } from './ban-doc/ban-doc.module.js';
import { BaoCaoModule } from './bao-cao/bao-cao.module.js';
import { AuthModule } from './auth/auth.module.js';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseExceptionFilter } from './common/filters/database-exception.filter.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    DocgiaModule,
    DanhMucModule,
    SachModule,
    MuonTraModule,
    DatTruocModule,
    PhatModule,
    BanDocModule,
    BaoCaoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: DatabaseExceptionFilter },
  ],
})
export class AppModule {}
