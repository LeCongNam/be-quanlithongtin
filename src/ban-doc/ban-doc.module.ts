import { Module } from '@nestjs/common';
import { BanDocController } from './ban-doc.controller.js';

@Module({ controllers: [BanDocController] })
export class BanDocModule {}
