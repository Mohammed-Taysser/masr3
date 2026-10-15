import { decimalTransformer } from '../decimal.transformer';

describe('decimalTransformer', () => {
  it('reads a pg decimal string as a number', () => {
    expect(decimalTransformer.from('25.50')).toBe(25.5);
  });

  it('keeps null as null', () => {
    expect(decimalTransformer.from(null)).toBeNull();
    expect(decimalTransformer.to(null)).toBeNull();
  });

  it('writes a number unchanged', () => {
    expect(decimalTransformer.to(25.5)).toBe(25.5);
  });
});
