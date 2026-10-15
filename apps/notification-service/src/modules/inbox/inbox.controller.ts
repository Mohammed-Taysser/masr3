import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '@masr3/libs/auth';

import CountResponseDto from './dto/count-response.dto';
import InboxItemResponseDto from './dto/inbox-item-response.dto';
import ListInboxQueryDto from './dto/list-inbox-query.dto';
import PaginatedInboxResponseDto from './dto/paginated-inbox-response.dto';
import InboxService from './inbox.service';

@ApiTags('Inbox')
@ApiBearerAuth()
@Controller('notifications/me')
class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get()
  @SerializeOptions({ type: PaginatedInboxResponseDto })
  @ApiOperation({
    summary: 'My inbox',
    description:
      'In-app notifications, newest first. Archived items are left out.',
  })
  @ApiOkResponse({ type: PaginatedInboxResponseDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListInboxQueryDto,
  ) {
    return this.inboxService.list(user.id, query);
  }

  @Get('unread-count')
  @SerializeOptions({ type: CountResponseDto })
  @ApiOperation({
    summary: 'My unread count',
    description: 'For the app badge.',
  })
  @ApiOkResponse({ type: CountResponseDto })
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.inboxService.unreadCount(user.id) };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ type: CountResponseDto })
  @ApiOperation({
    summary: 'Mark everything read',
    description: 'Returns how many items changed.',
  })
  @ApiOkResponse({ type: CountResponseDto })
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.inboxService.markAllRead(user.id) };
  }

  @Patch(':id/read')
  @SerializeOptions({ type: InboxItemResponseDto })
  @ApiOperation({ summary: 'Mark one read', description: 'Idempotent.' })
  @ApiOkResponse({ type: InboxItemResponseDto })
  @ApiNotFoundResponse({ description: 'Not in your inbox.' })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inboxService.markRead(user.id, id);
  }

  @Patch(':id/unread')
  @SerializeOptions({ type: InboxItemResponseDto })
  @ApiOperation({ summary: 'Mark one unread' })
  @ApiOkResponse({ type: InboxItemResponseDto })
  @ApiNotFoundResponse({ description: 'Not in your inbox.' })
  markUnread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inboxService.markUnread(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Archive one',
    description: 'Hides it from the inbox; the record is kept.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Not in your inbox.' })
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.inboxService.archive(user.id, id);
  }
}

export default InboxController;
