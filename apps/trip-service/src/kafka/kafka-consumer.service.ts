import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AuthKafkaTopic,
  BaseKafkaConsumer,
  KafkaSubscription,
  KafkaTopicHandlers,
} from '@masr3/libs/kafka';

import UserService from '../modules/user/user.service';
import { CONSUMED_EVENT_DTOS } from './kafka.constant';
import { ConsumedEventMap } from './kafka.interface';

@Injectable()
class KafkaConsumerService extends BaseKafkaConsumer<ConsumedEventMap> {
  protected readonly handlers: KafkaTopicHandlers<ConsumedEventMap>;
  protected readonly eventDtos = CONSUMED_EVENT_DTOS;

  // fromBeginning only applies while the group has no committed offset: a
  // new deployment rebuilds its copy of users from the whole topic.
  protected readonly subscriptions: KafkaSubscription<ConsumedEventMap>[] = [
    { topics: [AuthKafkaTopic.USER_CHANGED], fromBeginning: true },
  ];

  constructor(
    configService: ConfigService,
    private readonly userService: UserService,
  ) {
    super(configService);

    this.handlers = {
      [AuthKafkaTopic.USER_CHANGED]: (event) =>
        this.userService.applyUserChanged(event),
    };
  }
}

export default KafkaConsumerService;
