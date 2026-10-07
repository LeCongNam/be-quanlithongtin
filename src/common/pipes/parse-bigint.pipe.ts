import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** Khóa chính là BIGINT nên không dùng ParseIntPipe (mất độ chính xác ngoài 2^53). */
@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    if (!/^\d{1,19}$/.test(value)) {
      throw new BadRequestException('Id phải là số nguyên dương');
    }
    return BigInt(value);
  }
}
