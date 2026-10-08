import { PartialType } from '@nestjs/swagger';
import { CreateTheLoaiDto } from './create-the-loai.dto.js';

export class UpdateTheLoaiDto extends PartialType(CreateTheLoaiDto) {}
