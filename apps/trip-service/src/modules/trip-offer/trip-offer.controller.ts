import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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

import CreateTripOfferDto from './dto/create-trip-offer.dto';
import TripOfferResponseDto from './dto/trip-offer-response.dto';
import TripResponseDto from '../trip/dto/trip-response.dto';
import TripOfferService from './trip-offer.service';

@ApiTags('Trip offers')
@ApiBearerAuth()
@ApiParam({ name: 'tripId', type: Number, example: 7 })
@Controller('trips/:tripId/offers')
class TripOfferController {
  constructor(private readonly tripOfferService: TripOfferService) {}

  @Post()
  @Roles(UserRoleEnum.DRIVER)
  @SerializeOptions({ type: TripOfferResponseDto })
  @ApiOperation({
    summary: 'Make an offer',
    description:
      'A driver offers to do a REQUESTED trip for `amount`. One pending offer per driver per trip; a driver with an active trip cannot offer.',
  })
  @ApiCreatedResponse({ type: TripOfferResponseDto })
  @ApiNotFoundResponse({ description: 'The trip does not exist.' })
  @ApiConflictResponse({
    description:
      'The trip is no longer open, has expired, the driver is busy, or already has a pending offer on it.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() dto: CreateTripOfferDto,
  ) {
    return this.tripOfferService.create(tripId, user, dto.amount);
  }

  @Get()
  @Roles(UserRoleEnum.CUSTOMER, UserRoleEnum.ADMIN)
  @SerializeOptions({ type: TripOfferResponseDto })
  @ApiOperation({
    summary: 'List a trip’s offers',
    description:
      'Every offer on the trip, oldest first. Its customer or an admin only.',
  })
  @ApiOkResponse({ type: [TripOfferResponseDto] })
  @ApiNotFoundResponse({ description: 'Missing, or not the caller’s trip.' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', ParseIntPipe) tripId: number,
  ) {
    return this.tripOfferService.listForTrip(tripId, user);
  }

  @Post(':offerId/accept')
  @Roles(UserRoleEnum.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ type: TripResponseDto })
  @ApiOperation({
    summary: 'Accept an offer',
    description:
      'Assigns the offering driver at the offered amount and moves the trip to ACCEPTED. Every other pending offer is rejected.',
  })
  @ApiParam({ name: 'offerId', type: Number, example: 12 })
  @ApiOkResponse({ type: TripResponseDto })
  @ApiNotFoundResponse({ description: 'Missing, or not the caller’s trip.' })
  @ApiConflictResponse({
    description:
      'The offer is no longer pending, the trip is no longer REQUESTED, or the driver took another trip.',
  })
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', ParseIntPipe) tripId: number,
    @Param('offerId', ParseIntPipe) offerId: number,
  ) {
    return this.tripOfferService.accept(tripId, offerId, user);
  }

  @Post(':offerId/withdraw')
  @Roles(UserRoleEnum.DRIVER)
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ type: TripOfferResponseDto })
  @ApiOperation({ summary: 'Withdraw my pending offer' })
  @ApiParam({ name: 'offerId', type: Number, example: 12 })
  @ApiOkResponse({ type: TripOfferResponseDto })
  @ApiNotFoundResponse({ description: 'Missing, or not the caller’s offer.' })
  @ApiConflictResponse({ description: 'The offer is no longer pending.' })
  async withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', ParseIntPipe) tripId: number,
    @Param('offerId', ParseIntPipe) offerId: number,
  ) {
    return this.tripOfferService.withdraw(tripId, offerId, user);
  }
}

export default TripOfferController;
