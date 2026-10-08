import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ShowParamDto {
  @ApiProperty({ example: 1, minimum: 1, description: 'ID bản ghi cần truy vấn' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}
