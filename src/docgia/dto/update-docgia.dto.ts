import { PartialType } from '@nestjs/mapped-types';
import { CreateDocgiaDto } from './create-docgia.dto.js';

export class UpdateDocgiaDto extends PartialType(CreateDocgiaDto) {}
