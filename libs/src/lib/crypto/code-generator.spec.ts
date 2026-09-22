import { generateCode } from './code-generator';

describe('generateCode', () => {
  it('defaults to a 64-char hex string (32 bytes)', () => {
    const code = generateCode();

    expect(code).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates a hex string sized by byte length', () => {
    const code = generateCode(16, 'hex');

    expect(code).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates a numeric string sized by character length', () => {
    const code = generateCode(6, 'numeric');

    expect(code).toMatch(/^[0-9]{6}$/);
  });

  it('generates an alphanumeric string sized by character length', () => {
    const code = generateCode(10, 'alphanumeric');

    expect(code).toMatch(/^[A-Za-z0-9]{10}$/);
  });

  it('does not repeat the same code twice in a row', () => {
    expect(generateCode(6, 'numeric')).not.toBe(generateCode(6, 'numeric'));
  });
});
