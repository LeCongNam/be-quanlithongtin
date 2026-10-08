import { PartialType } from '@nestjs/swagger';
import { CreateSachDto } from './create-sach.dto.js';

export class UpdateSachDto extends PartialType(CreateSachDto) {}
