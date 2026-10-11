import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../modules/auth/decorators/public.decorator';

import { dayjs } from '@masr3/libs';

@ApiTags('Health')
@Controller('health')
class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness check' })
  @ApiOkResponse({
    schema: { example: { status: 'ok', service: 'auth-service' } },
  })
  check() {
    return {
      status: 'ok',
      service: this.configService.getOrThrow<string>('SERVICE_NAME'),
      timestamp: dayjs().toISOString(),
    };
  }
}

export default HealthController;
