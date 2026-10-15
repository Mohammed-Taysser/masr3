import { ServiceScopeEnum } from '@masr3/libs/auth';

interface ServiceClient {
  secretVariable: string;
  audiences: string[];
  scopes: ServiceScopeEnum[];
}

interface RegisteredClient extends ServiceClient {
  secretDigest: Buffer;
}

interface BasicCredentials {
  username: string;
  password: string;
}

export type { BasicCredentials, RegisteredClient, ServiceClient };
