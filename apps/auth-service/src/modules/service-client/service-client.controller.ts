import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  SerializeOptions,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBasicAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';

import { Public, SERVICE_TOKENS_PATH } from '@masr3/libs/auth';

import CreateServiceTokenDto from './dto/create-service-token.dto';
import ServiceTokenResponseDto from './dto/service-token-response.dto';
import { BASIC_AUTHENTICATE_HEADER } from './service-client.constant';
import ServiceClientService from './service-client.service';

@ApiTags('Internal')
@Controller(SERVICE_TOKENS_PATH)
class ServiceClientController {
  constructor(private readonly serviceClientService: ServiceClientService) {}

  @Post()
  // Public only skips the bearer guard: the handler authenticates the client's
  // Basic credentials itself.
  @Public()
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ type: ServiceTokenResponseDto })
  @Throttle({
    short: { limit: 10, ttl: 1000 },
    long: { limit: 120, ttl: 60000 },
  })
  @ApiBasicAuth()
  @ApiOperation({
    summary: 'Issue a service token (service-only)',
    description:
      'For other services, not for users. The caller authenticates with `Authorization: Basic base64(SERVICE_NAME:client secret)` and asks for an audience and scopes from its allowlist. Must not be routed by any public ingress.',
  })
  @ApiOkResponse({ type: ServiceTokenResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Unknown client, wrong secret or malformed Basic header.',
  })
  @ApiForbiddenResponse({
    description: 'The audience or a scope is not allowed for this client.',
  })
  issue(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: CreateServiceTokenDto,
    @Res({ passthrough: true }) response: Response,
  ): ServiceTokenResponseDto {
    try {
      return this.serviceClientService.issueToken(authorization, dto);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        response.setHeader('WWW-Authenticate', BASIC_AUTHENTICATE_HEADER);
      }

      throw error;
    }
  }
}

export default ServiceClientController;
