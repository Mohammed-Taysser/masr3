import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import AuditModule from '../audit/audit.module';
import InternalUsersController from './internal-users.controller';
import UsersController from './users.controller';
import UsersService from './users.service';
import UserEntity from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), AuditModule],
  controllers: [UsersController, InternalUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
class UsersModule {}

export default UsersModule;
