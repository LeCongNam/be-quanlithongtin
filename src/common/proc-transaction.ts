import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Gộp nhiều `CALL sp_*` thành một transaction (vd. lập phiếu + thêm từng bản sách).
 *
 * Procedure ghi dữ liệu tự `START TRANSACTION ... COMMIT` khi `@@autocommit = 1` (sql/04_procedures.sql, đầu file).
 * `prisma.$transaction` trần chỉ mở `BEGIN` nên autocommit vẫn = 1: procedure đầu tiên ngầm COMMIT phần việc
 * trước đó và mỗi procedure tự commit riêng, lỗi ở bước sau không hoàn tác được bước trước.
 * Với `autocommit = 0` procedure chạy trong transaction của bên gọi, lỗi thì ROLLBACK cả transaction.
 * `$transaction` interactive chỉ để giữ cùng một connection; autocommit được trả về 1 trước khi nhả connection về pool.
 */
export async function withProcTransaction<T>(
  prisma: Pick<PrismaClient, '$transaction'>,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET autocommit = 0`;
    try {
      const result = await fn(tx);
      await tx.$executeRaw`COMMIT`;
      return result;
    } catch (err) {
      await tx.$executeRaw`ROLLBACK`;
      throw err;
    } finally {
      await tx.$executeRaw`SET autocommit = 1`;
    }
  });
}
