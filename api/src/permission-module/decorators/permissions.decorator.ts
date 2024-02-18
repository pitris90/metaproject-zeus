import { Reflector } from '@nestjs/core';
import { Permission } from '../models/permission.enum';

export const PermissionsCheck = Reflector.createDecorator<Permission[]>();
