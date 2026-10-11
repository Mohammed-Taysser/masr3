enum TokenUseEnum {
  USER = 'USER',
  REFRESH = 'REFRESH',
  SERVICE = 'SERVICE',
}

enum ServiceScopeEnum {
  USERS_CONTACT_READ = 'USERS_CONTACT_READ',
}

enum UserRoleEnum {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export { ServiceScopeEnum, TokenUseEnum, UserRoleEnum };
