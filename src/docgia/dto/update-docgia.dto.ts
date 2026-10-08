import { PartialType } from '@nestjs/swagger';
import { CreateDocgiaDto } from './create-docgia.dto.js';

export class UpdateDocgiaDto extends PartialType(CreateDocgiaDto) {}
