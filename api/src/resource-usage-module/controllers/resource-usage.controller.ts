import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Public } from '../../auth-module/decorators/public.decorator';
import { ResourceUsageService } from '../services/resource-usage.service';
import { ResourceUsageEventsPayloadDto } from '../dtos/resource-usage-events-payload.dto';
import { CollectorApiKeyGuard } from '../guards/collector-api-key.guard';

@ApiTags('collector')
@Controller('collector/resource-usage')
@Public()
@UseGuards(CollectorApiKeyGuard)
export class ResourceUsageController {
  constructor(
    private readonly resourceUsageService: ResourceUsageService,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Submit resource usage events from collector',
    description:
      'Accepts batches of resource usage events from the collector service',
  })
  @ApiHeader({
    name: 'X-Zeus-Collector-Key',
    description: 'API key for collector authentication',
    required: true,
  })
  @ApiResponse({
    status: 201,
    description: 'Events successfully received and stored',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing API key',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  async submitEvents(@Body() payload: ResourceUsageEventsPayloadDto) {
    await this.resourceUsageService.createEvents(payload.events);
    return {
      received: payload.events.length,
      message: 'Events successfully processed',
    };
  }
}
