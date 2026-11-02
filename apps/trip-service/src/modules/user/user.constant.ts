import { UserRoleEnum } from '@masr3/libs/auth';

const UQ_USERS_USER_ID = 'UQ_users_user_id';

// Admins never take part in a trip, so the copy keeps only these roles.
const TRIP_PARTICIPANT_ROLES: readonly UserRoleEnum[] = [
  UserRoleEnum.CUSTOMER,
  UserRoleEnum.DRIVER,
];

export { TRIP_PARTICIPANT_ROLES, UQ_USERS_USER_ID };
