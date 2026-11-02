import {
  Body,
  Controller,
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
  ApiBadRequestResponse,
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
  UserRoleEnum,
} from '@masr3/libs/auth';
import { TripStatusEnum } from '@masr3/libs/kafka';

import CancelTripDto from './dto/cancel-trip.dto';
import CreateTripDto from './dto/create-trip.dto';
import ListTripsQueryDto from './dto/list-trips-query.dto';
import PaginatedTripsResponseDto, {
  PaginatedOpenTripsResponseDto,
} from './dto/paginated-trips-response.dto';
import TripHistoryResponseDto from './dto/trip-history-response.dto';
import TripResponseDto from './dto/trip-response.dto';
import UpdateRequestedVehicleTypeDto from './dto/update-requested-vehicle-type.dto';
import { TripListScopeEnum } from './trip.enum';
import TripService from './trip.service';

@ApiTags('Trips')
@ApiBearerAuth()
@Controller('trips')
class TripController {
  constructor(private readonly tripService: TripService) {}

  @Post()
  @Roles(UserRoleEnum.CUSTOMER, UserRoleEnum.ADMIN)
  @SerializeOptions({ type: TripResponseDto })
  @ApiOperation({
    summary: 'Request a trip',
    description:
      'Creates a REQUESTED ride or parcel trip with the fare the customer proposes. Drivers can make offers until `expiresAt`. A customer books for themselves; an admin books for the customer in `customerId`.',
  })
  @ApiCreatedResponse({ type: TripResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid body, or an admin left out `customerId`.',
  })
  @ApiForbiddenResponse({
    description: "A customer sent another customer's `customerId`.",
  })
  @ApiNotFoundResponse({
    description: 'The admin named an unknown customer.',
  })
  @ApiConflictResponse({
    description: 'The customer already has an active trip, or is deactivated.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTripDto,
  ) {
    return this.tripService.create(dto, user);
  }

  @Get()
  @Roles(UserRoleEnum.ADMIN)
  @SerializeOptions({ type: PaginatedTripsResponseDto })
  @ApiOperation({
    summary: 'List trips',
    description:
      'Every trip, newest first, filtered by customer, driver, status, type or requested vehicle type.',
  })
  @ApiOkResponse({ type: PaginatedTripsResponseDto })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTripsQueryDto,
  ) {
    return this.tripService.list(query, user, TripListScopeEnum.ALL);
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
    return this.tripService.list(query, user, TripListScopeEnum.MINE);
  }

  @Get('open')
  @Roles(UserRoleEnum.DRIVER, UserRoleEnum.ADMIN)
  @SerializeOptions({ type: PaginatedOpenTripsResponseDto })
  @ApiOperation({
    summary: 'List trips open for offers',
    description:
      'REQUESTED trips that have not expired, newest first. Parcel recipient details are hidden. Drivers and admins.',
  })
  @ApiOkResponse({ type: PaginatedOpenTripsResponseDto })
  async listOpen(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTripsQueryDto,
  ) {
    return this.tripService.list(query, user, TripListScopeEnum.OPEN);
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

  @Patch(':id/vehicle-type')
  @Roles(UserRoleEnum.CUSTOMER, UserRoleEnum.ADMIN)
  @SerializeOptions({ type: TripResponseDto })
  @ApiOperation({
    summary: 'Change the requested vehicle type',
    description:
      'Its customer or an admin, while the trip is REQUESTED, has not expired and has no pending offer. `null` accepts any vehicle type. Audited (audit-service).',
  })
  @ApiParam({ name: 'id', type: Number, example: 7 })
  @ApiOkResponse({
    description: 'Vehicle type updated successfully.',
    type: TripResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or missing requested vehicle type.',
  })
  @ApiNotFoundResponse({
    description: 'Missing, or not the caller’s trip.',
  })
  @ApiConflictResponse({
    description:
      'The trip is no longer REQUESTED, has expired, or has a pending offer.',
  })
  async updateRequestedVehicleType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRequestedVehicleTypeDto,
  ) {
    return this.tripService.updateRequestedVehicleType(id, dto, user);
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
  @ApiNotFoundResponse({
    description: 'Missing, or not the caller’s trip.',
  })
  @ApiConflictResponse({
    description: 'The trip can no longer be cancelled.',
  })
  @ApiForbiddenResponse({
    description: 'The caller’s role may not cancel it now.',
  })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelTripDto,
  ) {
    return this.tripService.transitionAs(
      id,
      TripStatusEnum.CANCELLED,
      user,
      dto.reason,
    );
  }

  @Post(':id/arrived')
  @Roles(UserRoleEnum.DRIVER, UserRoleEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ type: TripResponseDto })
  @ApiOperation({
    summary: 'Driver has arrived at the pickup',
    description: 'The assigned driver, or an admin for them.',
  })
  @ApiParam({ name: 'id', type: Number, example: 7 })
  @ApiOkResponse({ type: TripResponseDto })
  @ApiNotFoundResponse({
    description: 'Missing, or not assigned to the caller.',
  })
  @ApiConflictResponse({
    description: 'The trip is not ACCEPTED.',
  })
  async arrived(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tripService.transitionAs(
      id,
      TripStatusEnum.DRIVER_ARRIVED,
      user,
    );
  }

  @Post(':id/start')
  @Roles(UserRoleEnum.DRIVER, UserRoleEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ type: TripResponseDto })
  @ApiOperation({
    summary: 'Start the trip (rider or parcel picked up)',
    description: 'The assigned driver, or an admin for them.',
  })
  @ApiParam({ name: 'id', type: Number, example: 7 })
  @ApiOkResponse({ type: TripResponseDto })
  @ApiNotFoundResponse({
    description: 'Missing, or not assigned to the caller.',
  })
  @ApiConflictResponse({
    description: 'The driver has not arrived yet.',
  })
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tripService.transitionAs(id, TripStatusEnum.IN_PROGRESS, user);
  }

  @Post(':id/complete')
  @Roles(UserRoleEnum.DRIVER, UserRoleEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ type: TripResponseDto })
  @ApiOperation({
    summary: 'Complete the trip (dropped off)',
    description: 'The assigned driver, or an admin for them.',
  })
  @ApiParam({ name: 'id', type: Number, example: 7 })
  @ApiOkResponse({ type: TripResponseDto })
  @ApiNotFoundResponse({
    description: 'Missing, or not assigned to the caller.',
  })
  @ApiConflictResponse({
    description: 'The trip is not IN_PROGRESS.',
  })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tripService.transitionAs(id, TripStatusEnum.COMPLETED, user);
  }
}

export default TripController;
