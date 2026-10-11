import { Module } from '@nestjs/common';

import ServiceTokenProvider from './service-token.provider';

@Module({
  providers: [ServiceTokenProvider],
  exports: [ServiceTokenProvider],
})
class ServiceTokenModule {}

export default ServiceTokenModule;
