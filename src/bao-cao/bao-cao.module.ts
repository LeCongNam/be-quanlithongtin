import { Module } from '@nestjs/common';
import { BaoCaoController } from './bao-cao.controller.js';

@Module({ controllers: [BaoCaoController] })
export class BaoCaoModule {}
