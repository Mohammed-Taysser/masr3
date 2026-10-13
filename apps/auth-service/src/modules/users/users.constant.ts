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

export { USER_AUDITED_FIELDS };
