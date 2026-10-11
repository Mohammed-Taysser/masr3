enum AuthKafkaTopic {
  USER_REGISTER = 'auth.user-register',
  USER_LOGGED_IN = 'auth.user-logged-in',
  USER_LOGGED_OUT = 'auth.user-logged-out',
  USER_CHANGE_PASSWORD = 'auth.user-change-password',
  PASSWORD_RESET_REQUESTED = 'auth.password-reset-requested',
  PASSWORD_RESET_COMPLETED = 'auth.password-reset-completed',
}

export { AuthKafkaTopic };
