import { Injectable } from '@nestjs/common';

import AuthServiceClient from '../../clients/auth-service.client';
import { DEFAULT_LOCALE } from './notification.constant';
import { Recipient } from './notification.interface';

@Injectable()
class RecipientService {
  constructor(private readonly authServiceClient: AuthServiceClient) {}

  async find(userId: number): Promise<Recipient | null> {
    const contact = await this.authServiceClient.getUserContact(userId);

    if (!contact) {
      return null;
    }

    return {
      userId,
      firstName: contact.firstName,
      email: contact.email,
      phone: null,
      deviceToken: null,
      locale: DEFAULT_LOCALE,
    };
  }
}

export default RecipientService;
