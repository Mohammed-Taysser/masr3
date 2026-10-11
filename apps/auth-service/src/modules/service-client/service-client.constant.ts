import { ServiceScopeEnum } from '@masr3/libs';

import type { ServiceClient } from './service-client.interface';

// Policy lives in code, secrets in env. A client cannot grant itself an
// audience or a scope that is not listed here.
const SERVICE_CLIENTS: Record<string, ServiceClient> = {
  // Intentional: notification delivery may read contact data for any user id.
  'notification-service': {
    secretVariable: 'NOTIFICATION_SERVICE_CLIENT_SECRET',
    audiences: ['auth-service'],
    scopes: [ServiceScopeEnum.USERS_CONTACT_READ],
  },
};

const BASIC_SCHEME_PATTERN = /^Basic\s+(\S+)$/i;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const BASIC_AUTHENTICATE_HEADER = 'Basic realm="service-tokens"';

export {
  BASE64_PATTERN,
  BASIC_AUTHENTICATE_HEADER,
  BASIC_SCHEME_PATTERN,
  SERVICE_CLIENTS,
};
