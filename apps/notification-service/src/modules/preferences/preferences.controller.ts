import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import {
  AuthenticatedUser,
  CurrentUser,
  Roles,
  UserRoleEnum,
} from '@masr3/libs/auth';

import ChannelPreferencesResponseDto from './dto/channel-preferences-response.dto';
import UpdateChannelPreferencesDto from './dto/update-channel-preferences.dto';
import PreferencesService from './preferences.service';

@ApiTags('Notification preferences')
@ApiBearerAuth()
@Controller('notifications')
class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get('me/preferences')
  @SerializeOptions({ type: ChannelPreferencesResponseDto })
  @ApiOperation({
    summary: 'My channel preferences',
    description:
      'One switch per channel. Security notifications are always sent, whatever the switches say.',
  })
  @ApiOkResponse({ type: ChannelPreferencesResponseDto })
  find(@CurrentUser() user: AuthenticatedUser) {
    return this.preferencesService.find(user.id);
  }

  @Put('me/preferences')
  @SerializeOptions({ type: ChannelPreferencesResponseDto })
  @ApiOperation({
    summary: 'Change my channel preferences',
    description: 'Switches left out keep their value. Returns every switch.',
  })
  @ApiOkResponse({ type: ChannelPreferencesResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateChannelPreferencesDto,
  ) {
    return this.preferencesService.update(user.id, body);
  }

  @Get('users/:userId/preferences')
  @Roles(UserRoleEnum.ADMIN)
  @SerializeOptions({ type: ChannelPreferencesResponseDto })
  @ApiOperation({
    summary: "A user's channel preferences",
    description: 'Admin only, for support.',
  })
  @ApiParam({ name: 'userId', type: Number, example: 3 })
  @ApiOkResponse({ type: ChannelPreferencesResponseDto })
  findForUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.preferencesService.find(userId);
  }

  @Put('users/:userId/preferences')
  @Roles(UserRoleEnum.ADMIN)
  @SerializeOptions({ type: ChannelPreferencesResponseDto })
  @ApiOperation({
    summary: "Change a user's channel preferences",
    description:
      'Admin only, for support (e.g. a user asks by phone to stop SMS). Switches left out keep their value.',
  })
  @ApiParam({ name: 'userId', type: Number, example: 3 })
  @ApiOkResponse({ type: ChannelPreferencesResponseDto })
  updateForUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: UpdateChannelPreferencesDto,
  ) {
    return this.preferencesService.update(userId, body);
  }
}

export default PreferencesController;
