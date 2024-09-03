import { AuthGuard } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class OpenIdConnectGuard extends AuthGuard('open-id-connect') {}
