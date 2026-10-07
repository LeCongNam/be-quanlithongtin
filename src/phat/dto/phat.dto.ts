import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/page-query.dto.js';
import { TrangThaiPhieuPhat } from '../../common/db-enums.js';
import { SapXepParam } from '../../common/dto/sap-xep.js';

export const PHAT_SAP_XEP = ['ngayTao', 'soTien'] as const;

export class ListPhatQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(TrangThaiPhieuPhat)
  trangThai?: TrangThaiPhieuPhat;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  maNguoiDung?: string;

  @SapXepParam(PHAT_SAP_XEP)
  sapXep?: string;
}

export class HuyPhatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  lyDo!: string;
}
