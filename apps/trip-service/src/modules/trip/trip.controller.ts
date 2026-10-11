import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import {
  AuthenticatedUser,
  CurrentUser,
  Roles,
  TripActorEnum,
  TripStatusEnum,
  UserRoleEnum,
} from '@masr3/libs';

import CancelTripDto from './dto/cancel-trip.dto';
import CreateTripDto from './dto/create-trip.dto';
import ListTripsQueryDto from './dto/list-trips-query.dto';
import PaginatedTripsResponseDto, {
  PaginatedOpenTripsResponseDto,
} from './dto/paginated-trips-response.dto';
import TripHistoryResponseDto from './dto/trip-history-response.dto';
import TripResponseDto from './dto/trip-response.dto';
import { ROLE_TO_TRIP_ACTOR } from './trip.constant';
import TripService from './trip.service';

@ApiTags('Trips')
@ApiBearerAuth()
@Controller('trips')
class TripController {
  constructor(private readonly tripService: TripService) {}

  @Post()
  @Roles(UserRoleEnum.CUSTOMER)
  @SerializeOptions({ type: TripResponseDto })
  @ApiOperation({
    summary: 'Request a trip',
    description:
      'Creates a REQUESTED ride or parcel trip with the fare the customer proposes. Drivers can make offers until `expiresAt`.',
  })
  @ApiCreatedResponse({ type: TripResponseDto })
  @ApiConflictResponse({
    description: 'The customer already has an active trip.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTripDto,
  ) {
    return this.tripService.create({ ...dto, customerId: user.id });
  }

  @Get('me')
  @Roles(UserRoleEnum.CUSTOMER, UserRoleEnum.DRIVER)
  @SerializeOptions({ type: PaginatedTripsResponseDto })
  @ApiOperation({
    summary: 'List my trips',
    description:
      'A customer sees the trips they requested; a driver sees the trips assigned to them. Newest first.',
  })
  @ApiOkResponse({ type: PaginatedTripsResponseDto })
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTripsQueryDto,
  ) {
    return this.tripService.listMine(user, query);
  }

  @Get('open')
  @Roles(UserRoleEnum.DRIVER)
  @SerializeOptions({ type: PaginatedOpenTripsResponseDto })
  @ApiOperation({
    summary: 'List trips open for offers',
    description:
      'REQUESTED trips that have not expired, newest first. Parcel recipient details are hidden.',
  })
  @ApiOkResponse({ type: PaginatedOpenTripsResponseDto })
  async listOpen(@Query() query: ListTripsQueryDto) {
    return this.tripService.listOpen(query);
  }

  @Get(':id')
  @SerializeOptions({ type: TripResponseDto })
  @ApiOperation({
    summary: 'Get a trip',
    description:
      'Visible to its customer, its assigned driver, an admin, and any driver while it is REQUESTED (without recipient details).',
  })
  @ApiParam({ name: 'id', type: Number, example: 7 })
  @ApiOkResponse({ type: TripResponseDto })
  @ApiNotFoundResponse({
    description: 'Missing, or not visible to the caller.',
  })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tripService.findVisibleTrip(id, user);
  }

  @Get(':id/history')
  @SerializeOptions({ type: TripHistoryResponseDto })
  @ApiOperation({
    summary: 'Get a trip’s status history',
    description:
      'Every status change, oldest first. Its customer, assigned driver or an admin only.',
  })
  @ApiParam({ name: 'id', type: Number, example: 7 })
  @ApiOkResponse({ type: [TripHistoryResponseDto] })
  @ApiNotFoundResponse({
    description: 'Missing, or not visible to the caller.',
  })
  async findHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tripService.findHistoryFor(id, user);
  }

  @Post(':id/cancel')
  @Roles(UserRoleEnum.CUSTOMER, UserRoleEnum.DRIVER, UserRoleEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ type: TripResponseDto })
  @ApiOperation({
    summary: 'Cancel a trip',
    description:
      'The customer can cancel until the trip starts; the assigned driver once accepted; an admin any time before it starts. Pending offers are rejected.',
  })
  @ApiParam({ name: 'id', type: Number, example: 7 })
  @ApiOkResponse({ type: TripResponseDto })
  @ApiNotFoundResponse({ description: 'Missing, or not the caller’s trip.' })
  @ApiConflictResponse({ description: 'The trip can no longer be cancelled.' })
  @ApiForbiddenResponse({
    description: 'The caller’s role may not cancel it now.',
  })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelTripDto,
  ) {
    return this.tripService.transition({
      tripId: id,
      to: TripStatusEnum.CANCELLED,
      actor: ROLE_TO_TRIP_ACTOR[user.role],
      actorId: user.id,
      reason: dto.reason,
    });
  }

  @Post(':id/arrived')
  @Roles(UserRoleEnum.DRIVER)
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ type: TripResponseDto })
  @ApiOperation({ summary: 'Driver has arrived at the pickup' })
  @ApiParam({ name: 'id', type: Number, example: 7 })
  @ApiOkResponse({ type: TripResponseDto })
  @ApiNotFoundResponse({
    description: 'Missing, or not assigned to the caller.',
  })
  @ApiConflictResponse({ description: 'The trip is not ACCEPTED.' })
  async arrived(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.driverMove(user, id, TripStatusEnum.DRIVER_ARRIVED);
  }

  @Post(':id/start')
  @Roles(UserRoleEnum.DRIVER)
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ type: TripResponseDto })
  @ApiOperation({ summary: 'Start the trip (rider or parcel picked up)' })
  @ApiParam({ name: 'id', type: Number, example: 7 })
  @ApiOkResponse({ type: TripResponseDto })
  @ApiNotFoundResponse({
    description: 'Missing, or not assigned to the caller.',
  })
  @ApiConflictResponse({ description: 'The driver has not arrived yet.' })
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.driverMove(user, id, TripStatusEnum.IN_PROGRESS);
  }

  @Post(':id/complete')
  @Roles(UserRoleEnum.DRIVER)
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ type: TripResponseDto })
  @ApiOperation({ summary: 'Complete the trip (dropped off)' })
  @ApiParam({ name: 'id', type: Number, example: 7 })
  @ApiOkResponse({ type: TripResponseDto })
  @ApiNotFoundResponse({
    description: 'Missing, or not assigned to the caller.',
  })
  @ApiConflictResponse({ description: 'The trip is not IN_PROGRESS.' })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.driverMove(user, id, TripStatusEnum.COMPLETED);
  }

  private driverMove(
    user: AuthenticatedUser,
    tripId: number,
    to: TripStatusEnum,
  ) {
    return this.tripService.transition({
      tripId,
      to,
      actor: TripActorEnum.DRIVER,
      actorId: user.id,
    });
  }
}

export default TripController;
