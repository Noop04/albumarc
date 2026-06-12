import { decryptPayload, encryptPayload } from "../session-crypto";

describe("session crypto", () => {
  it("round-trips encrypt and decrypt", () => {
    const payload = { refreshToken: "secret-token", accessToken: "access" };
    const encrypted = encryptPayload(payload);
    const decrypted = decryptPayload<typeof payload>(encrypted);
    expect(decrypted).toEqual(payload);
  });

  it("returns null for tampered payload", () => {
    const encrypted = encryptPayload({ value: "ok" });
    const tampered = `${encrypted.slice(0, -4)}xxxx`;
    expect(decryptPayload(tampered)).toBeNull();
  });
});
