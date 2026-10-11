import { Module } from '@nestjs/common';

import AppConfigModule from '../config/config.module';
import HealthController from './health.controller';

@Module({
  imports: [AppConfigModule],
  controllers: [HealthController],
})
class HealthModule {}

export default HealthModule;
