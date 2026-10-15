import { PaginatedResponseDto } from '@masr3/libs/pagination';

import UserResponseDto from './user-response.dto';

class PaginatedUsersResponseDto extends PaginatedResponseDto(UserResponseDto) {}

export default PaginatedUsersResponseDto;
