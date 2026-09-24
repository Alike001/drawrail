import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  address,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  getBase58Decoder,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { hashNonWalletSignatures } from "./transaction-validator";
import { verifySignedReviewedTransaction } from "./signed-transaction";

async function signedFixture() {
  const keys = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as unknown as CryptoKeyPair;
  const publicBytes = new Uint8Array(await webcrypto.subtle.exportKey("raw", keys.publicKey));
  const wallet = address(getBase58Decoder().decode(publicBytes));
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (value) => setTransactionMessageFeePayer(wallet, value),
    (value) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: blockhash("4vAhwGzTFgJgC6pPespe1NwpcBZ4AGoEW8sXbFU1yfhK"), lastValidBlockHeight: 10n }, value),
  );
  const unsigned = compileTransaction(message);
  const signature = new Uint8Array(await webcrypto.subtle.sign("Ed25519", keys.privateKey, Uint8Array.from(unsigned.messageBytes)));
  const signed = { ...unsigned, signatures: { ...unsigned.signatures, [wallet]: signature } };
  const messageHash = await crypto.subtle.digest("SHA-256", Uint8Array.from(unsigned.messageBytes));
  return {
    wallet,
    signedTransactionBase64: Buffer.from(getTransactionEncoder().encode(signed as never)).toString("base64"),
    expectedMessageHash: Buffer.from(messageHash).toString("hex"),
    expectedNonWalletSignaturesHash: hashNonWalletSignatures(unsigned.signatures, wallet),
  };
}

describe("signed transaction binding", () => {
  it("cryptographically verifies the wallet signature on the exact reviewed message", async () => {
    const fixture = await signedFixture();
    await expect(verifySignedReviewedTransaction(fixture)).resolves.toMatchObject({ signatureVerified: true, wallet: fixture.wallet });
  });

  it("rejects message and signer binding mismatches", async () => {
    const fixture = await signedFixture();
    await expect(verifySignedReviewedTransaction({ ...fixture, expectedMessageHash: "0".repeat(64) })).rejects.toThrow("reviewed message");
    await expect(verifySignedReviewedTransaction({ ...fixture, wallet: "11111111111111111111111111111111" })).rejects.toThrow("signature is missing");
  });

  it("rejects invalid signatures", async () => {
    const fixture = await signedFixture();
    const wire = Buffer.from(fixture.signedTransactionBase64, "base64");
    wire[1] ^= 1;
    await expect(verifySignedReviewedTransaction({ ...fixture, signedTransactionBase64: wire.toString("base64") })).rejects.toThrow();
  });
});
