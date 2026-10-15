import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { RequireServiceScopes, ServiceScopeEnum } from '@masr3/libs/auth';

import UserContactResponseDto from './dto/user-contact-response.dto';
import UsersService from './users.service';

@ApiTags('internal')
@ApiBearerAuth()
@RequireServiceScopes(ServiceScopeEnum.USERS_CONTACT_READ)
@Throttle({
  short: { limit: 100, ttl: 1000 },
  medium: { limit: 1000, ttl: 10000 },
  long: { limit: 5000, ttl: 60000 },
})
@Controller('internal/users')
class InternalUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id/contact')
  @SerializeOptions({ type: UserContactResponseDto })
  @ApiOperation({
    summary: 'Get a user contact (service-only)',
    description:
      'For other services, not for users. Needs a service token for audience `auth-service` with the `USERS_CONTACT_READ` scope; any user token, including an ADMIN one, gets 401. Must not be routed by any public ingress.',
  })
  @ApiParam({ name: 'id', type: Number, example: 2 })
  @ApiOkResponse({ type: UserContactResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid service token.' })
  @ApiForbiddenResponse({ description: 'The token lacks the required scope.' })
  @ApiNotFoundResponse({ description: 'No user with this id.' })
  async findContact(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserContactResponseDto> {
    const user = await this.usersService.findByIdOrFail(id);

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}

export default InternalUsersController;
