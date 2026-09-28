import { decodeFriendCode, encodeFriendQR, parseFriendQR } from '../../friendQR';

/** The friend QR payload and the kit's friend-code format (`base64({"u","n"})`). */
const code = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64');

describe('parseFriendQR', () => {
  it('round-trips an encoded friend code and ignores other QR codes', () => {
    expect(parseFriendQR(encodeFriendQR('abc'))).toBe('abc');
    expect(parseFriendQR('https://example.com')).toBeNull();
    expect(parseFriendQR('obscura:friend:   ')).toBeNull();
  });
});

describe('decodeFriendCode', () => {
  it('reads the user id and name from a kit friend code', () => {
    expect(decodeFriendCode(code({ u: 'user-1', n: 'alice' }))).toEqual({ userId: 'user-1', username: 'alice' });
  });

  it('accepts the url-safe base64 variant, like the kit', () => {
    const urlSafe = code({ u: 'u?>', n: 'bob~~' }).replace(/\+/g, '-').replace(/\//g, '_');
    expect(decodeFriendCode(urlSafe)).toEqual({ userId: 'u?>', username: 'bob~~' });
  });

  it('rejects anything that is not a complete friend code', () => {
    expect(decodeFriendCode('not base64 json')).toBeNull();
    expect(decodeFriendCode(code({ u: 'user-1' }))).toBeNull();
    expect(decodeFriendCode(code({ u: '', n: 'alice' }))).toBeNull();
    expect(decodeFriendCode(code(['u', 'n']))).toBeNull();
  });
});
