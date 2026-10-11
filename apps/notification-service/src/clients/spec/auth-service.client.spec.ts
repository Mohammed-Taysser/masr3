import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { ServiceScopeEnum, ServiceTokenProvider } from '@masr3/libs';

import AuthServiceClient from '../auth-service.client';

describe('AuthServiceClient', () => {
  let get: jest.SpyInstance;
  let error: jest.SpyInstance;
  let serviceTokenProvider: jest.Mocked<ServiceTokenProvider>;
  let client: AuthServiceClient;

  const contact = {
    userId: 2,
    email: 'customer@masr3.local',
    firstName: 'Demo',
    lastName: 'Customer',
  };

  beforeEach(() => {
    get = jest.spyOn(axios, 'get');
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    serviceTokenProvider = {
      getToken: jest.fn().mockResolvedValue('service-token'),
    } as unknown as jest.Mocked<ServiceTokenProvider>;
    client = new AuthServiceClient(
      {
        getOrThrow: () => 'http://localhost:7000/api',
      } as unknown as ConfigService,
      serviceTokenProvider,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('calls the internal route with a service token for auth-service', async () => {
    get.mockResolvedValue({ status: 200, data: contact });

    await expect(client.getUserContact(2)).resolves.toEqual(contact);
    expect(serviceTokenProvider.getToken).toHaveBeenCalledWith('auth-service', [
      ServiceScopeEnum.USERS_CONTACT_READ,
    ]);
    expect(get).toHaveBeenCalledWith(
      'http://localhost:7000/api/internal/users/2/contact',
      expect.objectContaining({
        headers: { Authorization: 'Bearer service-token' },
        maxRedirects: 0,
      }),
    );
  });

  it('returns null for a missing user', async () => {
    get.mockResolvedValue({ status: 404, data: {} });

    await expect(client.getUserContact(2)).resolves.toBeNull();
  });

  it.each([
    ['an unexpected status', { status: 401, data: {} }, 'status 401'],
    ['a server error', { status: 500, data: {} }, 'status 500'],
    [
      'a malformed body',
      { status: 200, data: { userId: '2' } },
      'malformed response body',
    ],
  ])('maps %s to 503', async (_case, response, logged) => {
    get.mockResolvedValue(response);

    await expect(client.getUserContact(2)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(error.mock.calls[0][0]).toContain(logged);
  });

  it('maps a timeout to 503', async () => {
    get.mockRejectedValue(new Error('timeout of 3000ms exceeded'));

    await expect(client.getUserContact(2)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(error.mock.calls[0][0]).toContain('network error or timeout');
  });

  it('never logs the token', async () => {
    get.mockResolvedValue({ status: 500, data: {} });

    await expect(client.getUserContact(2)).rejects.toThrow();
    expect(JSON.stringify(error.mock.calls)).not.toContain('service-token');
  });
});
