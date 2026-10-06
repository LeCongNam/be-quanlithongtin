import type { Prisma } from '@prisma/client';
import { withProcTransaction } from './proc-transaction.js';

function fakePrisma() {
  const sql: string[] = [];
  const tx = {
    $executeRaw: (strings: TemplateStringsArray) => {
      sql.push(strings.join('?'));
      return Promise.resolve(0);
    },
  } as unknown as Prisma.TransactionClient;
  const prisma = {
    $transaction: (fn: (t: Prisma.TransactionClient) => Promise<unknown>) =>
      fn(tx),
  } as never;
  return { prisma, tx, sql };
}

describe('withProcTransaction', () => {
  it('tắt autocommit, COMMIT khi thành công rồi bật lại autocommit', async () => {
    const { prisma, tx, sql } = fakePrisma();
    const result = await withProcTransaction(prisma, async (t) => {
      expect(t).toBe(tx);
      await t.$executeRaw`CALL sp_x()`;
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(sql).toEqual([
      'SET autocommit = 0',
      'CALL sp_x()',
      'COMMIT',
      'SET autocommit = 1',
    ]);
  });

  it('ROLLBACK, bật lại autocommit và ném lại lỗi khi thất bại', async () => {
    const { prisma, sql } = fakePrisma();
    const err = new Error('loi');
    await expect(
      withProcTransaction(prisma, () => Promise.reject(err)),
    ).rejects.toBe(err);
    expect(sql).toEqual([
      'SET autocommit = 0',
      'ROLLBACK',
      'SET autocommit = 1',
    ]);
  });
});
