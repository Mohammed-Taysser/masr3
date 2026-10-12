import { MailAttachment } from '../mail/mail.interface';
import NotificationDeliveryEntity from './entities/notification-delivery.entity';
import NotificationEntity from './entities/notification.entity';
import {
  DeliverySkipReasonEnum,
  DeliveryStatusEnum,
  NotificationCategoryEnum,
  NotificationChannelEnum,
  NotificationTypeEnum,
  TripCancelledByEnum,
} from './notification.enum';

interface WelcomeData {
  email: string;
}

interface NewLoginData {
  occurredAt: string;
  ip: string | null;
  userAgent: string | null;
}

interface SecurityChangeData {
  occurredAt: string;
}

interface PasswordResetData {
  expiresInMinutes: number;
}

interface TripRouteData {
  tripId: number;
  pickupAddress: string;
  dropoffAddress: string;
}

interface TripConfirmedData extends TripRouteData {
  fare: number;
  currency: string;
  driverName: string | null;
}

interface TripAssignedData extends TripRouteData {
  fare: number;
  currency: string;
  customerFirstName: string | null;
}

interface TripReceiptData extends TripRouteData {
  fare: number;
  currency: string;
  completedAt: string;
  driverName: string | null;
}

interface TripCancelledData extends TripRouteData {
  cancelledBy: TripCancelledByEnum;
  reason: string | null;
}

interface TripExpiredData extends TripRouteData {
  fare: number;
  currency: string;
}

interface NotificationDataMap {
  [NotificationTypeEnum.WELCOME]: WelcomeData;
  [NotificationTypeEnum.NEW_LOGIN]: NewLoginData;
  [NotificationTypeEnum.PASSWORD_CHANGED]: SecurityChangeData;
  [NotificationTypeEnum.PASSWORD_RESET]: PasswordResetData;
  [NotificationTypeEnum.PASSWORD_RESET_COMPLETED]: SecurityChangeData;
  [NotificationTypeEnum.TRIP_CONFIRMED]: TripConfirmedData;
  [NotificationTypeEnum.TRIP_ASSIGNED]: TripAssignedData;
  [NotificationTypeEnum.TRIP_RECEIPT]: TripReceiptData;
  [NotificationTypeEnum.TRIP_CANCELLED]: TripCancelledData;
  [NotificationTypeEnum.TRIP_EXPIRED]: TripExpiredData;
}

// Values a template needs that must never be stored: they travel only in the
// delivery job (e.g. a password reset link).
type NotificationSecrets = Record<string, string>;

// A reference to a file in storage, never its bytes.
type EmailAttachment = MailAttachment;

interface NotificationIntent<
  Type extends NotificationTypeEnum = NotificationTypeEnum,
> {
  type: Type;
  userId: number;
  data: NotificationDataMap[Type];
  // Unique per notification: a redelivered event produces the same key and is
  // dropped. Usually `${eventId}:${type}:${userId}`.
  dedupeKey: string;
  // Overrides the catalog's default channels, to send on one specific channel.
  channels?: NotificationChannelEnum[];
  secrets?: NotificationSecrets;
  attachments?: EmailAttachment[];
}

interface CatalogEntry {
  category: NotificationCategoryEnum;
  defaultChannels: NotificationChannelEnum[];
  // A mandatory notification ignores the user's opt-outs.
  mandatory: boolean;
  // Needs NotificationSecrets to render, so it can't be rebuilt from the row.
  hasSecrets: boolean;
  // A Handlebars template over the data, e.g. masr3://trips/{{tripId}}.
  deepLink: string | null;
}

interface Recipient {
  userId: number;
  firstName: string;
  email: string | null;
  phone: string | null;
  deviceToken: string | null;
  locale: string;
}

interface RenderInput {
  type: NotificationTypeEnum;
  channel: NotificationChannelEnum;
  locale: string;
  firstName: string;
  address: string | null;
  data: object;
  secrets?: NotificationSecrets;
  attachments?: EmailAttachment[] | null;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
}

interface RenderedShortMessage {
  title: string;
  body: string;
  deepLink: string | null;
}

interface RenderedText {
  text: string;
}

type RenderedMessage = RenderedEmail | RenderedShortMessage | RenderedText;

interface ProviderResult {
  providerMessageId: string | null;
}

interface ChannelProvider {
  readonly configured: boolean;
  send(
    delivery: NotificationDeliveryEntity,
    message: RenderedMessage,
  ): Promise<ProviderResult>;
}

interface PlannedDelivery {
  channel: NotificationChannelEnum;
  address: string | null;
  status: DeliveryStatusEnum;
  skipReason: DeliverySkipReasonEnum | null;
}

interface SavedNotification {
  notification: NotificationEntity;
  deliveries: NotificationDeliveryEntity[];
}

interface DeliveryJobData {
  deliveryId: number;
  secrets?: NotificationSecrets;
}

export type {
  CatalogEntry,
  ChannelProvider,
  DeliveryJobData,
  EmailAttachment,
  NewLoginData,
  NotificationDataMap,
  NotificationIntent,
  NotificationSecrets,
  PasswordResetData,
  PlannedDelivery,
  ProviderResult,
  Recipient,
  RenderInput,
  RenderedEmail,
  RenderedMessage,
  RenderedShortMessage,
  RenderedText,
  SavedNotification,
  SecurityChangeData,
  TripAssignedData,
  TripCancelledData,
  TripConfirmedData,
  TripExpiredData,
  TripReceiptData,
  WelcomeData,
};
