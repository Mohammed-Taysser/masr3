import MailService from '../../mail/mail.service';
import EmailProvider from '../delivery/providers/email.provider';
import NotificationDeliveryEntity from '../entities/notification-delivery.entity';

describe('EmailProvider', () => {
  const mailService = {
    sendMail: jest.fn().mockResolvedValue('<id@mailhog>'),
  } as unknown as jest.Mocked<MailService>;
  const provider = new EmailProvider(mailService);
  const attachments = [
    {
      filename: 'trips.pdf',
      contentType: 'application/pdf',
      url: 'http://files/trips.pdf',
    },
  ];

  it('sends to the delivery address, attachments included, and returns the message id', async () => {
    await expect(
      provider.send(
        {
          id: 31,
          address: 'customer@masr3.local',
        } as NotificationDeliveryEntity,
        {
          subject: 'Your trip receipt',
          html: '<p/>',
          text: 'text',
          attachments,
        },
      ),
    ).resolves.toEqual({ providerMessageId: '<id@mailhog>' });

    expect(mailService.sendMail).toHaveBeenCalledWith({
      to: 'customer@masr3.local',
      subject: 'Your trip receipt',
      html: '<p/>',
      text: 'text',
      attachments,
    });
  });

  it('refuses a delivery without an address', async () => {
    await expect(
      provider.send({ id: 31, address: null } as NotificationDeliveryEntity, {
        subject: 's',
        html: 'h',
        text: 't',
        attachments: [],
      }),
    ).rejects.toThrow('Delivery 31 has no email address');
  });
});
