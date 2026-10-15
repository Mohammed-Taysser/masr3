import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AuditEventMap,
  AuditKafkaTopic,
  BaseKafkaConsumer,
  KafkaEventDtos,
  KafkaSubscription,
  KafkaTopicHandlers,
} from '@masr3/libs/kafka';

import AuditService from '../modules/audit/audit.service';
import AuditActionRecordedEventDto from '../modules/audit/dto/audit-action-recorded-event.dto';

@Injectable()
class KafkaConsumerService extends BaseKafkaConsumer<AuditEventMap> {
  protected readonly handlers: KafkaTopicHandlers<AuditEventMap>;

  protected readonly eventDtos: KafkaEventDtos<AuditEventMap> = {
    [AuditKafkaTopic.ACTION_RECORDED]: AuditActionRecordedEventDto,
  };

  // fromBeginning only applies while the group has no committed offset: the
  // first run records every action already on the topic. Replays are safe
  // because each eventId is recorded once.
  protected readonly subscriptions: KafkaSubscription<AuditEventMap>[] = [
    { topics: Object.values(AuditKafkaTopic), fromBeginning: true },
  ];

  constructor(
    configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    super(configService);

    // The envelope is generic, so a new audited action needs no new handler.
    this.handlers = {
      [AuditKafkaTopic.ACTION_RECORDED]: (event) =>
        this.auditService.record(event),
    };
  }
}

export default KafkaConsumerService;
