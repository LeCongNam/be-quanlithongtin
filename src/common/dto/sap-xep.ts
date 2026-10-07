import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export type HuongSapXep = 'asc' | 'desc';

export interface SapXep<F extends string> {
  field: F;
  dir: HuongSapXep;
}

/**
 * Query `sapXep=<field>:<asc|desc>`. Mỗi endpoint khai danh sách field cho phép (whitelist); field lạ bị
 * ValidationPipe từ chối (400) nên service chỉ nhận field đã biết và tự ánh xạ sang cột, không nối chuỗi từ client.
 */
export function SapXepParam(fields: readonly string[]) {
  const pattern = `^(${fields.join('|')}):(asc|desc)$`;
  return applyDecorators(
    ApiPropertyOptional({
      type: 'string',
      pattern,
      example: `${fields[0]}:desc`,
      description: `Sắp xếp theo một cột: \`<field>:<asc|desc>\`, field thuộc: ${fields.map((f) => `\`${f}\``).join(', ')}. Bỏ trống thì dùng thứ tự mặc định của endpoint. Khóa phụ cố định luôn được nối thêm để phân trang không lệch.`,
    }),
    IsOptional(),
    Matches(new RegExp(pattern), {
      message: `sapXep phải có dạng <field>:<asc|desc>, field thuộc: ${fields.join(', ')}`,
    }),
  );
}

/** Tách giá trị đã qua validate của `SapXepParam`; `undefined` khi không truyền. */
export function parseSapXep<F extends string>(
  raw: string | undefined,
): SapXep<F> | undefined {
  if (!raw) return undefined;
  const [field, dir] = raw.split(':');
  return { field: field as F, dir: dir as HuongSapXep };
}
