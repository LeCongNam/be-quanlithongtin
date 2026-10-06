import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export function paginate<T>(
  data: T[],
  total: number,
  { page, limit }: PageQueryDto,
) {
  return { data, total, page, limit };
}

export function skipTake({ page, limit }: PageQueryDto) {
  return { skip: (page - 1) * limit, take: limit };
}
