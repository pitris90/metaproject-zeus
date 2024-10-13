import { Reflector } from '@nestjs/core';
import { RoleEnum } from '../models/role.enum';

export const MinRoleCheck = Reflector.createDecorator<RoleEnum>();
