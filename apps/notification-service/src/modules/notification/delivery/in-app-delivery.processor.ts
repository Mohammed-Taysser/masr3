import { Processor } from '@nestjs/bullmq';

import { NOTIFICATION_IN_APP_QUEUE } from '../notification.constant';
import ChannelDeliveryProcessor from './channel-delivery.processor';

@Processor(NOTIFICATION_IN_APP_QUEUE)
class InAppDeliveryProcessor extends ChannelDeliveryProcessor {}

export default InAppDeliveryProcessor;
