import { Body, Controller, Get, Put, SerializeOptions } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '@masr3/libs/auth';

import ChannelPreferencesResponseDto from './dto/channel-preferences-response.dto';
import UpdateChannelPreferencesDto from './dto/update-channel-preferences.dto';
import PreferencesService from './preferences.service';

@ApiTags('Notification preferences')
@ApiBearerAuth()
@Controller('notifications/me/preferences')
class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
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

  @Put()
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
}

export default PreferencesController;
