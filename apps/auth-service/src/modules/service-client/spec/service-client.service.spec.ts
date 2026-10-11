import {
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ServiceScopeEnum,
  TokenUseEnum,
  USER_TOKEN_AUDIENCE,
} from '@masr3/libs';

import SigningKeyService from '../../signing-key/signing-key.service';
import { SERVICE_CLIENTS } from '../service-client.constant';
import ServiceClientService from '../service-client.service';

const SECRET = 'ab'.repeat(32);

describe('ServiceClientService', () => {
  let signingKeyService: jest.Mocked<SigningKeyService>;
  let config: Record<string, unknown>;
  let service: ServiceClientService;

  const create = () =>
    new ServiceClientService(
      {
        get: (key: string) => config[key],
        getOrThrow: (key: string) => config[key],
      } as unknown as ConfigService,
      signingKeyService,
    );
  const basic = (username: string, password: string) =>
    `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const dto = {
    audience: 'auth-service',
    scopes: [ServiceScopeEnum.USERS_CONTACT_READ],
  };

  beforeEach(() => {
    signingKeyService = {
      sign: jest.fn().mockReturnValue('service-token'),
    } as unknown as jest.Mocked<SigningKeyService>;
    config = {
      NOTIFICATION_SERVICE_CLIENT_SECRET: SECRET,
      SERVICE_TOKEN_EXPIRES_IN_SECONDS: 300,
    };
    service = create();
  });

  afterEach(() => jest.restoreAllMocks());

  it('issues a token with the service claims for the requested audience', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    expect(
      service.issueToken(basic('notification-service', SECRET), dto),
    ).toEqual({
      accessToken: 'service-token',
      tokenType: 'Bearer',
      expiresIn: 300,
    });
    expect(signingKeyService.sign).toHaveBeenCalledWith(
      {
        sub: 'notification-service',
        tokenUse: TokenUseEnum.SERVICE,
        scopes: [ServiceScopeEnum.USERS_CONTACT_READ],
      },
      'auth-service',
      300,
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(log.mock.calls)).not.toContain('service-token');
  });

  it.each([
    ['no header', undefined],
    ['a malformed header', 'Basic !!!'],
    ['an unknown client', basic('trip-service', SECRET)],
    ['a prototype key as client', basic('constructor', SECRET)],
    ['a wrong secret', basic('notification-service', 'cd'.repeat(32))],
    ['a secret of another length', basic('notification-service', 'short')],
  ])('rejects %s with 401', (_case, header) => {
    expect(() => service.issueToken(header, dto)).toThrow(
      UnauthorizedException,
    );
    expect(signingKeyService.sign).not.toHaveBeenCalled();
  });

  it('rejects a disallowed audience with 403', () => {
    expect(() =>
      service.issueToken(basic('notification-service', SECRET), {
        ...dto,
        audience: 'trip-service',
      }),
    ).toThrow(ForbiddenException);
  });

  it('rejects a request where any scope is disallowed with 403', () => {
    expect(() =>
      service.issueToken(basic('notification-service', SECRET), {
        ...dto,
        scopes: [
          ServiceScopeEnum.USERS_CONTACT_READ,
          'TRIPS_WRITE' as ServiceScopeEnum,
        ],
      }),
    ).toThrow(ForbiddenException);
  });

  describe('boot validation', () => {
    it.each([
      ['a missing secret', undefined],
      ['a secret that is not 64 hex characters', 'ab'.repeat(31)],
      ['an uppercase secret', 'AB'.repeat(32)],
    ])('fails on %s', (_case, secret) => {
      config['NOTIFICATION_SERVICE_CLIENT_SECRET'] = secret;

      expect(() => create()).toThrow(/NOTIFICATION_SERVICE_CLIENT_SECRET/);
    });

    it('fails when a client lists the user-token audience', () => {
      const client = SERVICE_CLIENTS['notification-service'];
      const original = client.audiences;

      client.audiences = [USER_TOKEN_AUDIENCE];

      try {
        expect(() => create()).toThrow(/audience/);
      } finally {
        client.audiences = original;
      }
    });
  });

  describe('parseBasicCredentials', () => {
    const encode = (value: string) => Buffer.from(value).toString('base64');
    const parse = (header: string | undefined) =>
      service['parseBasicCredentials'](header);

    it('parses a well-formed header', () => {
      expect(parse(`Basic ${encode('client:secret')}`)).toEqual({
        username: 'client',
        password: 'secret',
      });
    });

    it.each(['basic', 'BASIC', 'bAsIc'])(
      'accepts the scheme as %s',
      (scheme) => {
        expect(parse(`${scheme} ${encode('a:b')}`)).toEqual({
          username: 'a',
          password: 'b',
        });
      },
    );

    it('splits at the first colon only', () => {
      expect(parse(`Basic ${encode('a:b:c')}`)).toEqual({
        username: 'a',
        password: 'b:c',
      });
    });

    it.each([
      ['no header', undefined],
      ['an empty header', ''],
      ['the Bearer scheme', `Bearer ${encode('a:b')}`],
      ['no credentials', 'Basic '],
      ['invalid base64 characters', 'Basic YT!6Yg=='],
      ['bad padding', 'Basic YTpi='],
      ['a length that is not a multiple of 4', 'Basic YTpiYw'],
      ['non-canonical base64', 'Basic YTpiYx=='],
      ['no colon', `Basic ${encode('ab')}`],
      ['an empty username', `Basic ${encode(':b')}`],
      ['an empty password', `Basic ${encode('a:')}`],
    ])('returns null for %s', (_case, header) => {
      expect(parse(header)).toBeNull();
    });
  });
});
