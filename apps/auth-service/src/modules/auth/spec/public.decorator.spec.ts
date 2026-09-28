import { IS_PUBLIC_KEY, Public } from '../decorators/public.decorator';

describe('Public', () => {
  it('uses the isPublic metadata key', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('sets the metadata to true on a handler', () => {
    class Target {
      handler() {
        return null;
      }
    }

    Public()(Target.prototype, 'handler', {
      value: Target.prototype.handler,
    });

    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, Target.prototype.handler),
    ).toBe(true);
  });
});
