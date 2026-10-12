import { Processor } from '@nestjs/bullmq';

import { NOTIFICATION_EMAIL_QUEUE } from '../notification.constant';
import ChannelDeliveryProcessor from './channel-delivery.processor';

@Processor(NOTIFICATION_EMAIL_QUEUE)
class EmailDeliveryProcessor extends ChannelDeliveryProcessor {}

export default EmailDeliveryProcessor;
