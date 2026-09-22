import {
  Body,
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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import UsersService from './users.service';
import CreateUserDto from './dto/create-user.dto';
import UpdateUserDto from './dto/update-user.dto';
import UpdateUserStatusDto from './dto/update-user-status.dto';
import ListUsersQueryDto from './dto/list-users-query.dto';
import { UserRoleEnum } from './users.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import JwtAuthGuard from '../auth/guards/jwt-auth.guard';
import RolesGuard from '../auth/guards/roles.guard';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List users',
    description:
      'Returns a paginated list of users with optional search, role, status, sorting, and pagination filters.',
  })
  @ApiOkResponse({
    description: 'Users retrieved successfully.',
  })
  async findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user by id',
    description: 'Returns a single user by their id.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 2,
    description: 'Id of the user.',
  })
  @ApiOkResponse({
    description: 'User retrieved successfully.',
  })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findByIdOrFail(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a user',
    description: 'Creates a new user account.',
  })
  @ApiCreatedResponse({
    description: 'User created successfully.',
  })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a user',
    description: 'Partially updates a user account.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 2,
    description: 'Id of the user to update.',
  })
  @ApiOkResponse({
    description: 'User updated successfully.',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({
    summary: 'Activate or deactivate an account',
    description:
      'Updates the active status of a user account. Deactivating an account immediately prevents its existing JWTs from being accepted by the authentication guard.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 2,
    description: 'Id of the user whose status should change.',
  })
  @ApiNoContentResponse({
    description: 'Status updated.',
  })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<void> {
    await this.usersService.setActive(id, dto.isActive);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a user',
    description:
      'Permanently deletes a user account and returns the deleted user.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 2,
    description: 'Id of the user to delete.',
  })
  @ApiOkResponse({
    description: 'User deleted successfully.',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}

export default UsersController;
