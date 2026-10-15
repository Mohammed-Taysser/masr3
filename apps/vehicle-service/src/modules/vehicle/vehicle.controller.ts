import {
  Body,
  Controller,
  Delete,
  Get,
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

import CreateVehicleDto from './dto/create-vehicle.dto';
import ListVehiclesQueryDto from './dto/list-vehicles-query.dto';
import PaginatedVehiclesResponseDto from './dto/paginated-vehicles-response.dto';
import UpdateOperationalStatusDto from './dto/update-operational-status.dto';
import UpdateVehicleDto from './dto/update-vehicle.dto';
import UpdateVerificationStatusDto from './dto/update-verification-status.dto';
import VehicleResponseDto from './dto/vehicle-response.dto';
import VehicleService from './vehicle.service';

@ApiTags('Vehicles')
@ApiBearerAuth()
@Controller('vehicles')
class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post()
  @Roles(UserRoleEnum.DRIVER, UserRoleEnum.ADMIN)
  @SerializeOptions({ type: VehicleResponseDto })
  @ApiOperation({
    summary: 'Add a vehicle',
    description:
      'A driver adds a vehicle of their own; an admin adds one for the driver in `driverId`. It starts PENDING and INACTIVE.',
  })
  @ApiCreatedResponse({ type: VehicleResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid body, or an admin left out `driverId`.',
  })
  @ApiForbiddenResponse({
    description: "A driver sent another driver's `driverId`.",
  })
  @ApiNotFoundResponse({ description: 'The driver is unknown.' })
  @ApiConflictResponse({
    description: 'The plate number is taken, or the driver is deactivated.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehicleService.create(dto, user);
  }

  @Get()
  @Roles(UserRoleEnum.ADMIN)
  @SerializeOptions({ type: PaginatedVehiclesResponseDto })
  @ApiOperation({
    summary: 'List vehicles',
    description:
      'Every vehicle, newest first, filtered by driver, type or status and searched by plate, make, model or driver name.',
  })
  @ApiOkResponse({ type: PaginatedVehiclesResponseDto })
  async list(@Query() query: ListVehiclesQueryDto) {
    return this.vehicleService.list(query);
  }

  @Get('me')
  @Roles(UserRoleEnum.DRIVER)
  @SerializeOptions({ type: PaginatedVehiclesResponseDto })
  @ApiOperation({
    summary: 'List my vehicles',
    description: "The caller's own vehicles, newest first.",
  })
  @ApiOkResponse({ type: PaginatedVehiclesResponseDto })
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListVehiclesQueryDto,
  ) {
    return this.vehicleService.listMine(user, query);
  }

  @Get(':id')
  @Roles(UserRoleEnum.DRIVER, UserRoleEnum.ADMIN)
  @SerializeOptions({ type: VehicleResponseDto })
  @ApiOperation({
    summary: 'Get a vehicle',
    description: 'Its driver or an admin only.',
  })
  @ApiParam({ name: 'id', type: Number, example: 12 })
  @ApiOkResponse({ type: VehicleResponseDto })
  @ApiNotFoundResponse({
    description: 'Missing, or not visible to the caller.',
  })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vehicleService.findVisible(id, user);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.DRIVER, UserRoleEnum.ADMIN)
  @SerializeOptions({ type: VehicleResponseDto })
  @ApiOperation({
    summary: 'Update a vehicle',
    description:
      'Its driver or an admin. Statuses are not editable here; see the status endpoints.',
  })
  @ApiParam({ name: 'id', type: Number, example: 12 })
  @ApiOkResponse({ type: VehicleResponseDto })
  @ApiNotFoundResponse({
    description: 'Missing, or not visible to the caller.',
  })
  @ApiConflictResponse({ description: 'The plate number is taken.' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehicleService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRoleEnum.DRIVER, UserRoleEnum.ADMIN)
  @SerializeOptions({ type: VehicleResponseDto })
  @ApiOperation({
    summary: 'Delete a vehicle',
    description: 'Its driver or an admin. Returns the deleted vehicle.',
  })
  @ApiParam({ name: 'id', type: Number, example: 12 })
  @ApiOkResponse({ type: VehicleResponseDto })
  @ApiNotFoundResponse({
    description: 'Missing, or not visible to the caller.',
  })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vehicleService.remove(id, user);
  }

  @Patch(':id/verification-status')
  @Roles(UserRoleEnum.ADMIN)
  @SerializeOptions({ type: VehicleResponseDto })
  @ApiOperation({
    summary: 'Verify a vehicle',
    description:
      'PENDING → APPROVED or REJECTED, APPROVED → REJECTED, REJECTED → PENDING. An ACTIVE vehicle must be deactivated first. Audited with the reason (audit-service).',
  })
  @ApiParam({ name: 'id', type: Number, example: 12 })
  @ApiOkResponse({ type: VehicleResponseDto })
  @ApiNotFoundResponse({ description: 'The vehicle does not exist.' })
  @ApiConflictResponse({ description: 'The move is not allowed.' })
  async changeVerificationStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVerificationStatusDto,
  ) {
    return this.vehicleService.changeVerificationStatus(id, dto, user);
  }

  @Patch(':id/operational-status')
  @Roles(UserRoleEnum.ADMIN)
  @SerializeOptions({ type: VehicleResponseDto })
  @ApiOperation({
    summary: 'Activate, deactivate or suspend a vehicle',
    description:
      'INACTIVE ↔ ACTIVE (ACTIVE needs APPROVED), ACTIVE or INACTIVE → SUSPENDED, SUSPENDED → INACTIVE. Audited with the reason (audit-service).',
  })
  @ApiParam({ name: 'id', type: Number, example: 12 })
  @ApiOkResponse({ type: VehicleResponseDto })
  @ApiNotFoundResponse({ description: 'The vehicle does not exist.' })
  @ApiConflictResponse({ description: 'The move is not allowed.' })
  async changeOperationalStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperationalStatusDto,
  ) {
    return this.vehicleService.changeOperationalStatus(id, dto, user);
  }
}

export default VehicleController;
