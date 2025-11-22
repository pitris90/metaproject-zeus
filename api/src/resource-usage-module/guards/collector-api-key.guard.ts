import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CollectorApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(CollectorApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const rawHeader = request.headers['x-zeus-collector-key'];
    const apiKey = this.normalizeHeaderValue(rawHeader);

    this.logger.debug(`Received header: ${rawHeader ? 'present' : 'missing'}`);
    this.logger.debug(`Normalized key (first 16): ${apiKey?.substring(0, 16)}...`);

    if (!apiKey) {
      this.logger.warn('Missing X-Zeus-Collector-Key header');
      throw new UnauthorizedException('Missing X-Zeus-Collector-Key header');
    }

    const validApiKey = this.configService
      .get<string>('COLLECTOR_API_KEY')
      ?.trim();

    this.logger.debug(`Expected key (first 16): ${validApiKey?.substring(0, 16)}...`);

    if (!validApiKey) {
      this.logger.error('Collector API key not configured on server');
      throw new UnauthorizedException('Collector API key not configured');
    }

    if (apiKey !== validApiKey) {
      this.logger.warn(
        `API key mismatch. Received length: ${apiKey.length}, Expected length: ${validApiKey.length}`,
      );
      throw new UnauthorizedException('Invalid API key');
    }

    this.logger.debug('API key validated successfully');
    return true;
  }

  private normalizeHeaderValue(
    headerValue: string | string[] | undefined,
  ): string | undefined {
    if (!headerValue) {
      return undefined;
    }
    const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    return value?.trim();
  }
}
