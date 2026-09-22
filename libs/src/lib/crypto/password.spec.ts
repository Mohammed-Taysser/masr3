import { comparePassword, hashPassword } from './password';

describe('password', () => {
  describe('hashPassword / comparePassword', () => {
    it('hashes a password so it no longer matches the plain text', async () => {
      const hash = await hashPassword('plain-pw');

      expect(hash).not.toBe('plain-pw');
    });

    it('accepts the correct password against its own hash', async () => {
      const hash = await hashPassword('plain-pw');

      await expect(comparePassword('plain-pw', hash)).resolves.toBe(true);
    });

    it('rejects the wrong password against a hash', async () => {
      const hash = await hashPassword('plain-pw');

      await expect(comparePassword('wrong-pw', hash)).resolves.toBe(false);
    });
  });
});
