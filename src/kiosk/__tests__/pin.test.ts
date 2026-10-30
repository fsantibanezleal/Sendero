import { hashPin, isValidPin, newSalt, verifyPin } from '../pin';

/** Deterministic fake digest: not secure, only sensitive to the whole input string. */
const digest = async (input: string): Promise<string> => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return `${input.length.toString(16)}-${h.toString(16)}-${input}`;
};

describe('PIN validation', () => {
  it('accepts 4 to 8 digits', () => {
    for (const pin of ['1234', '12345', '123456', '1234567', '12345678', '0000']) {
      expect(isValidPin(pin)).toBe(true);
    }
  });

  it('rejects short, long, non-digit and empty values', () => {
    for (const pin of ['', '123', '123456789', '12a4', '12 34', '12.4', '-123', '12\n34']) {
      expect(isValidPin(pin)).toBe(false);
    }
  });
});

describe('PIN hashing', () => {
  it('hashes salt + ":" + pin through the injected digest', async () => {
    const calls: string[] = [];
    const spy = async (s: string) => {
      calls.push(s);
      return 'abc';
    };
    expect(await hashPin('1234', 'ff00', spy)).toBe('abc');
    expect(calls).toEqual(['ff00:1234']);
  });

  it('is stable for the same salt and changes with the salt', async () => {
    const a = await hashPin('1234', 'aa', digest);
    expect(await hashPin('1234', 'aa', digest)).toBe(a);
    expect(await hashPin('1234', 'bb', digest)).not.toBe(a);
  });

  it('throws on an invalid PIN', async () => {
    await expect(hashPin('12', 'aa', digest)).rejects.toThrow();
  });
});

describe('PIN verification', () => {
  it('verifies the right PIN and rejects a wrong one', async () => {
    const stored = { salt: 'cafe', hash: await hashPin('4321', 'cafe', digest) };
    expect(await verifyPin('4321', stored, digest)).toBe(true);
    expect(await verifyPin('4322', stored, digest)).toBe(false);
  });

  it('compares the full hash, not a prefix', async () => {
    const hash = await hashPin('4321', 'cafe', digest);
    expect(await verifyPin('4321', { salt: 'cafe', hash: hash.slice(0, -1) }, digest)).toBe(false);
    expect(await verifyPin('4321', { salt: 'cafe', hash: `${hash}0` }, digest)).toBe(false);
  });

  it('rejects an invalid PIN without computing a digest', async () => {
    let called = false;
    const spy = async () => {
      called = true;
      return 'x';
    };
    expect(await verifyPin('abc', { salt: 'a', hash: 'x' }, spy)).toBe(false);
    expect(called).toBe(false);
  });
});

describe('salt', () => {
  it('is 16 bytes as 32 lowercase hex characters', () => {
    const salt = newSalt((n) => Uint8Array.from({ length: n }, (_, i) => i * 17));
    expect(salt).toBe('00112233445566778899aabbccddeeff');
  });

  it('differs when the random bytes differ', () => {
    const a = newSalt((n) => new Uint8Array(n).fill(1));
    const b = newSalt((n) => new Uint8Array(n).fill(2));
    expect(a).not.toBe(b);
  });
});
