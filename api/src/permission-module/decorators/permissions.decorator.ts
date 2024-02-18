import { Reflector } from '@nestjs/core';
import { PermissionEnum } from '../models/permission.enum';

export const PermissionsCheck = Reflector.createDecorator<PermissionEnum[]>();
