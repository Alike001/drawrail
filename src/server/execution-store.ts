import "server-only";
import { createHash } from "node:crypto";
import type { JupiterExecutionResult } from "./jupiter";

export type SubmissionRecord = Readonly<{
  key: string;
  state: "reserved" | "submitted";
  signature: string | null;
  outcome: "pending" | "confirmed" | "confirmed_needs_investigation" | "failed" | "unknown";
  createdAt: string;
  jupiter: JupiterExecutionResult | null;
}>;

const records = new Map<string, SubmissionRecord>();

export function executionKey(receipt: string): string {
  return createHash("sha256").update(receipt).digest("hex");
}

export function reserveExecution(receipt: string, now = new Date()): SubmissionRecord {
  const key = executionKey(receipt);
  if (records.has(key)) throw new Error("This reviewed drawdown has already been submitted or reserved");
  const record: SubmissionRecord = { key, state: "reserved", signature: null, outcome: "pending", createdAt: now.toISOString(), jupiter: null };
  records.set(key, record);
  return record;
}

export function recordSubmission(receipt: string, update: Pick<SubmissionRecord, "signature" | "outcome"> & Partial<Pick<SubmissionRecord, "jupiter">>): SubmissionRecord {
  const key = executionKey(receipt);
  const existing = records.get(key);
  if (!existing) throw new Error("Execution was not reserved");
  const record: SubmissionRecord = { ...existing, state: "submitted", ...update };
  records.set(key, record);
  return record;
}

export function getSubmission(receipt: string): SubmissionRecord | null {
  return records.get(executionKey(receipt)) ?? null;
}

export function resetExecutionStoreForTests(): void {
  if (process.env.NODE_ENV !== "test") throw new Error("Execution store reset is test-only");
  records.clear();
}
