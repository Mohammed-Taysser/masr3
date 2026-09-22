import { OmitType, PartialType } from '@nestjs/swagger';
import CreateUserDto from './create-user.dto';

class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password']),
) {}

export default UpdateUserDto;
