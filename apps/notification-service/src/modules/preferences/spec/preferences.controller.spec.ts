import { AuthenticatedUser, ROLES_KEY, UserRoleEnum } from '@masr3/libs/auth';

import PreferencesController from '../preferences.controller';
import PreferencesService from '../preferences.service';

const rolesOf = (method: keyof PreferencesController) =>
  Reflect.getMetadata(ROLES_KEY, PreferencesController.prototype[method]);

describe('PreferencesController', () => {
  let controller: PreferencesController;
  let preferencesService: jest.Mocked<PreferencesService>;

  const user = {
    id: 3,
    role: UserRoleEnum.CUSTOMER,
    email: 'x@masr3.local',
    tokenVersion: 0,
  } as AuthenticatedUser;

  beforeEach(() => {
    preferencesService = {
      find: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<PreferencesService>;

    controller = new PreferencesController(preferencesService);
  });

  it.each([
    ['find', undefined],
    ['update', undefined],
    ['findForUser', [UserRoleEnum.ADMIN]],
    ['updateForUser', [UserRoleEnum.ADMIN]],
  ] as const)('%s requires roles %p', (method, roles) => {
    expect(rolesOf(method)).toEqual(roles);
  });

  it("reads and changes the caller's own preferences", async () => {
    await controller.find(user);
    await controller.update(user, { sms: false });

    expect(preferencesService.find).toHaveBeenCalledWith(3);
    expect(preferencesService.update).toHaveBeenCalledWith(3, { sms: false });
  });

  it("reads and changes the named user's preferences for an admin", async () => {
    await controller.findForUser(8);
    await controller.updateForUser(8, { sms: false });

    expect(preferencesService.find).toHaveBeenCalledWith(8);
    expect(preferencesService.update).toHaveBeenCalledWith(8, { sms: false });
  });
});
