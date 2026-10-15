import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Roles, UserRoleEnum } from '@masr3/libs/auth';

import AuditService from './audit.service';
import AuditResponseDto from './dto/audit-response.dto';
import ListAuditsQueryDto from './dto/list-audits-query.dto';
import PaginatedAuditsResponseDto from './dto/paginated-audits-response.dto';

@ApiTags('Admin: audits')
@ApiBearerAuth()
@Controller('admin/audits')
@Roles(UserRoleEnum.ADMIN)
class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @SerializeOptions({ type: PaginatedAuditsResponseDto })
  @ApiOperation({
    summary: 'List audits',
    description:
      'Every recorded action across services, newest first. Filter by entityType and entityId for one entity history, by actorId for everything a user did, and by occurredFrom / occurredTo for a time window.',
  })
  @ApiOkResponse({ type: PaginatedAuditsResponseDto })
  @ApiForbiddenResponse({ description: 'The caller is not an admin.' })
  list(@Query() query: ListAuditsQueryDto) {
    return this.auditService.list(query);
  }

  @Get(':id')
  @SerializeOptions({ type: AuditResponseDto })
  @ApiOperation({
    summary: 'Get an audit',
    description: 'One recorded action, with its changes and metadata.',
  })
  @ApiOkResponse({ type: AuditResponseDto })
  @ApiNotFoundResponse({ description: 'No such audit.' })
  @ApiForbiddenResponse({ description: 'The caller is not an admin.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.auditService.findOne(id);
  }
}

export default AuditController;
