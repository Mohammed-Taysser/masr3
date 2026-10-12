import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Roles, UserRoleEnum } from '@masr3/libs';

import DeliveryLogService from './delivery/delivery-log.service';
import DeliveryResponseDto from './dto/delivery-response.dto';
import ListDeliveriesQueryDto from './dto/list-deliveries-query.dto';
import PaginatedDeliveriesResponseDto from './dto/paginated-deliveries-response.dto';

@ApiTags('Admin: deliveries')
@ApiBearerAuth()
@Controller('admin/notifications/deliveries')
@Roles(UserRoleEnum.ADMIN)
class DeliveriesController {
  constructor(private readonly deliveryLogService: DeliveryLogService) {}

  @Get()
  @SerializeOptions({ type: PaginatedDeliveriesResponseDto })
  @ApiOperation({
    summary: 'List deliveries',
    description:
      'Every channel delivery, newest first, including skipped ones with their reason. Filter by status=FAILED for the dead-letter view.',
  })
  @ApiOkResponse({ type: PaginatedDeliveriesResponseDto })
  list(@Query() query: ListDeliveriesQueryDto) {
    return this.deliveryLogService.list(query);
  }

  @Post(':id/retry')
  @SerializeOptions({ type: DeliveryResponseDto })
  @ApiOperation({
    summary: 'Retry a failed delivery',
    description:
      'Queues a FAILED delivery again. Any other status answers 409.',
  })
  @ApiOkResponse({ type: DeliveryResponseDto })
  @ApiNotFoundResponse({ description: 'No such delivery.' })
  @ApiConflictResponse({ description: 'Not FAILED, or its secret is gone.' })
  retry(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryLogService.retry(id);
  }
}

export default DeliveriesController;
