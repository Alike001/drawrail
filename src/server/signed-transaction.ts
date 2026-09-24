import "server-only";
import { createHash, webcrypto } from "node:crypto";
import { address, getBase58Encoder, getTransactionDecoder } from "@solana/kit";
import { hashNonWalletSignatures } from "./transaction-validator";

export type SignedTransactionEvidence = Readonly<{
  messageHash: string;
  nonWalletSignaturesHash: string;
  wallet: string;
  userSignature: string;
  signatureVerified: true;
  signedTransaction: string;
}>;

export async function verifySignedReviewedTransaction(input: Readonly<{
  signedTransactionBase64: string;
  wallet: string;
  expectedMessageHash: string;
  expectedNonWalletSignaturesHash: string;
}>): Promise<SignedTransactionEvidence> {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.signedTransactionBase64)) throw new Error("Malformed signed transaction");
  const wire = Buffer.from(input.signedTransactionBase64, "base64");
  if (wire.length === 0 || wire.length > 1_232) throw new Error("Signed transaction wire size is invalid");
  const transaction = getTransactionDecoder().decode(wire);
  const messageHash = createHash("sha256").update(Buffer.from(transaction.messageBytes)).digest("hex");
  if (messageHash !== input.expectedMessageHash) throw new Error("Signed transaction message does not match the reviewed message");
  const signature = transaction.signatures[address(input.wallet)];
  if (!signature) throw new Error("The reviewed wallet signature is missing");
  const nonWalletSignaturesHash = hashNonWalletSignatures(transaction.signatures, input.wallet);
  if (nonWalletSignaturesHash !== input.expectedNonWalletSignaturesHash) {
    throw new Error("A non-wallet signature slot changed after review");
  }
  const publicKeyBytes = getBase58Encoder().encode(input.wallet);
  if (publicKeyBytes.length !== 32) throw new Error("Reviewed wallet public key is malformed");
  const publicKey = await webcrypto.subtle.importKey("raw", publicKeyBytes, { name: "Ed25519" }, false, ["verify"]);
  const valid = await webcrypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    Uint8Array.from(signature),
    Uint8Array.from(transaction.messageBytes),
  );
  if (!valid) throw new Error("Wallet signature does not verify against the reviewed message");
  return {
    messageHash,
    nonWalletSignaturesHash,
    wallet: input.wallet,
    userSignature: Buffer.from(signature).toString("base64"),
    signatureVerified: true,
    signedTransaction: input.signedTransactionBase64,
  };
}
