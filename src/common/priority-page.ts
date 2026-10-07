/**
 * Phân trang khi một nhóm dòng phải đứng trước (vd. phiếu phạt chưa thu). Prisma không `orderBy` theo biểu thức
 * nên nối hai truy vấn, nhóm ưu tiên rồi phần còn lại, và chỉ lấy đúng cửa sổ [skip, skip + take).
 * Mỗi nhóm tự sắp thứ tự bên trong trong `findFirst`/`findRest` (kèm khóa phụ unique để trang không lệch).
 */
export async function pagePriorityFirst<T>({
  skip,
  take,
  countFirst,
  countRest,
  findFirst,
  findRest,
}: {
  skip: number;
  take: number;
  countFirst: () => Promise<number>;
  countRest: () => Promise<number>;
  findFirst: (skip: number, take: number) => Promise<T[]>;
  findRest: (skip: number, take: number) => Promise<T[]>;
}) {
  const [nFirst, nRest] = await Promise.all([countFirst(), countRest()]);
  const first =
    skip < nFirst ? await findFirst(skip, Math.min(take, nFirst - skip)) : [];
  const restTake = take - first.length;
  const rest =
    restTake > 0 ? await findRest(Math.max(skip - nFirst, 0), restTake) : [];
  return { data: [...first, ...rest], total: nFirst + nRest };
}
