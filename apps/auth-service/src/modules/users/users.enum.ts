enum UserRoleEnum {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

enum UserSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
  EMAIL = 'email',
}

enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export { UserRoleEnum, UserSortBy, SortOrder };
