import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AuthEventMap,
  AuthKafkaTopic,
  BaseKafkaConsumer,
  KafkaSubscription,
  KafkaTopicHandlers,
} from '@masr3/libs/kafka';

import DriverService from '../modules/driver/driver.service';
import { CONSUMED_EVENT_DTOS, ConsumedKafkaTopic } from './kafka.constant';

type ConsumedEventMap = Pick<AuthEventMap, ConsumedKafkaTopic>;

@Injectable()
class KafkaConsumerService extends BaseKafkaConsumer<ConsumedEventMap> {
  protected readonly handlers: KafkaTopicHandlers<ConsumedEventMap>;
  protected readonly eventDtos = CONSUMED_EVENT_DTOS;

  // fromBeginning only applies while the group has no committed offset: a
  // new deployment rebuilds its copy of drivers from the whole topic.
  protected readonly subscriptions: KafkaSubscription<ConsumedEventMap>[] = [
    { topics: [AuthKafkaTopic.USER_CHANGED], fromBeginning: true },
  ];

  constructor(
    configService: ConfigService,
    private readonly driverService: DriverService,
  ) {
    super(configService);

    this.handlers = {
      [AuthKafkaTopic.USER_CHANGED]: (event) =>
        this.driverService.applyUserChanged(event),
    };
  }
}

export default KafkaConsumerService;
