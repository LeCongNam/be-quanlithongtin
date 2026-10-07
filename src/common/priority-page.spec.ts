import { pagePriorityFirst } from './priority-page.js';

// Nhóm ưu tiên: A1..A3; phần còn lại: B1..B4
const A = ['A1', 'A2', 'A3'];
const B = ['B1', 'B2', 'B3', 'B4'];

const page = (skip: number, take: number) =>
  pagePriorityFirst({
    skip,
    take,
    countFirst: async () => A.length,
    countRest: async () => B.length,
    findFirst: async (s, t) => A.slice(s, s + t),
    findRest: async (s, t) => B.slice(s, s + t),
  });

describe('pagePriorityFirst', () => {
  it('trang đầu nằm trọn trong nhóm ưu tiên', async () => {
    expect(await page(0, 2)).toEqual({ data: ['A1', 'A2'], total: 7 });
  });

  it('trang giữa nối cuối nhóm ưu tiên với đầu phần còn lại', async () => {
    expect((await page(2, 3)).data).toEqual(['A3', 'B1', 'B2']);
  });

  it('trang nằm hẳn trong phần còn lại', async () => {
    expect((await page(4, 2)).data).toEqual(['B2', 'B3']);
  });

  it('vượt quá tổng thì rỗng nhưng total vẫn đúng', async () => {
    expect(await page(10, 5)).toEqual({ data: [], total: 7 });
  });

  it('duyệt hết các trang không trùng, không sót', async () => {
    const all = [
      ...(await page(0, 3)).data,
      ...(await page(3, 3)).data,
      ...(await page(6, 3)).data,
    ];
    expect(all).toEqual([...A, ...B]);
  });
});
