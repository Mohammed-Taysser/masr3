import { AuthEventMap, AuthKafkaTopic, TripEventMap } from '@masr3/libs/kafka';

// auth.user-changed is for services that keep a copy of users; nothing here
// is notified about it, so it is not consumed.
type ConsumedAuthKafkaTopic = Exclude<
  AuthKafkaTopic,
  AuthKafkaTopic.USER_CHANGED
>;

type ConsumedEventMap = Pick<AuthEventMap, ConsumedAuthKafkaTopic> &
  TripEventMap;

export type { ConsumedAuthKafkaTopic, ConsumedEventMap };
