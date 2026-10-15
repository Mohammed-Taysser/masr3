import UserEntity from './entities/user.entity';

// The only user columns an audit diff may contain. The password, its reset
// token hash and expiry are left out on purpose and must stay out.
const USER_AUDITED_FIELDS: readonly (keyof UserEntity & string)[] = [
  'email',
  'firstName',
  'lastName',
  'role',
  'isActive',
  'tokenVersion',
];

// The fields auth.user-changed carries. A write that changes none of them
// (a login, a password change) publishes nothing.
const USER_SNAPSHOT_FIELDS: readonly (keyof UserEntity & string)[] = [
  'firstName',
  'lastName',
  'role',
  'isActive',
];

export { USER_AUDITED_FIELDS, USER_SNAPSHOT_FIELDS };
