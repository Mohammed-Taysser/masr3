import { Module } from '@nestjs/common';

import SigningKeyModule from '../signing-key/signing-key.module';
import ServiceClientController from './service-client.controller';
import ServiceClientService from './service-client.service';

@Module({
  imports: [SigningKeyModule],
  controllers: [ServiceClientController],
  providers: [ServiceClientService],
})
class ServiceClientModule {}

export default ServiceClientModule;
