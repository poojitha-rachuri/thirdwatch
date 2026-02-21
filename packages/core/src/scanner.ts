// Scanner stub — Plan 03 implements this fully
import type { TDM } from "@thirdwatch/tdm";
import type { LanguageAnalyzerPlugin } from "./plugin.js";

export interface ScanOptions {
  root: string;
  plugins: LanguageAnalyzerPlugin[];
  ignore?: string[];
  configFile?: string;
  previousTdm?: TDM;
  resolveEnv?: boolean;
  concurrency?: number;
}

export async function scan(_options: ScanOptions): Promise<TDM> {
  throw new Error("scan() is not yet implemented — see Plan 03");
}
