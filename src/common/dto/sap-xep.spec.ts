import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { parseSapXep, SapXepParam } from './sap-xep.js';

class Q {
  @SapXepParam(['ngayMuon', 'maPhieu'])
  sapXep?: string;
}

const loi = async (sapXep?: string) =>
  (await validate(plainToInstance(Q, { sapXep }))).length;

describe('SapXepParam', () => {
  it('chấp nhận field trong whitelist với asc/desc', async () => {
    expect(await loi('ngayMuon:asc')).toBe(0);
    expect(await loi('maPhieu:desc')).toBe(0);
  });

  it('cho phép bỏ trống', async () => {
    expect(await loi(undefined)).toBe(0);
  });

  it.each([
    'id:asc',
    'ngayMuon',
    'ngayMuon:up',
    'ngayMuon:ASC',
    'ngayMuon:asc; DROP TABLE sach',
    'xngayMuon:asc',
    ':asc',
  ])('từ chối %s', async (v) => {
    expect(await loi(v)).toBe(1);
  });
});

describe('parseSapXep', () => {
  it('tách field và hướng', () => {
    expect(parseSapXep('ngayMuon:desc')).toEqual({
      field: 'ngayMuon',
      dir: 'desc',
    });
  });

  it('không truyền thì undefined', () => {
    expect(parseSapXep(undefined)).toBeUndefined();
    expect(parseSapXep('')).toBeUndefined();
  });
});
