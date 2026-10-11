import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import InternalUsersController from './internal-users.controller';
import UsersController from './users.controller';
import UsersService from './users.service';
import UserEntity from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController, InternalUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
class UsersModule {}

export default UsersModule;
