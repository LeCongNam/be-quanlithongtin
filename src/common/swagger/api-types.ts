import { ApiProperty } from '@nestjs/swagger';

/** Khóa BIGINT: Prisma trả BigInt, `bigint-json.ts` tuần tự hóa thành chuỗi. */
export const ApiBigInt = (description?: string, nullable = false) =>
  ApiProperty({ type: String, example: '1', description, nullable });

/** DECIMAL: Prisma trả Decimal và JSON hóa thành chuỗi (giữ nguyên độ chính xác). */
export const ApiDecimal = (description?: string, nullable = false) =>
  ApiProperty({ type: String, example: '85000.00', description, nullable });

/** Cột enum của DB (CHECK constraint): đặt tên enum để FE sinh được kiểu union. */
export const ApiEnum = (enumType: object, enumName: string, nullable = false) =>
  ApiProperty({ enum: enumType, enumName, nullable });
