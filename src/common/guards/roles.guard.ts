import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthUser } from '../decorators/current-user.decorator.js';
import { VaiTroTaiKhoan } from '../db-enums.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<
      VaiTroTaiKhoan[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;

    const user = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>().user;
    if (!user || !roles.includes(user.vaiTro)) {
      throw new ForbiddenException('Khong du quyen thuc hien thao tac nay');
    }
    return true;
  }
}
