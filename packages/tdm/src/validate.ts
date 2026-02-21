// Stub — full implementation in Plan 02
import type { TDM } from "./types.js";

export class TDMValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TDMValidationError";
  }
}

export function parseTDM(input: unknown): TDM {
  if (typeof input !== "object" || input === null) {
    throw new TDMValidationError("TDM must be an object");
  }
  return input as TDM;
}

export function parseTDMFromString(json: string): TDM {
  return parseTDM(JSON.parse(json));
}
