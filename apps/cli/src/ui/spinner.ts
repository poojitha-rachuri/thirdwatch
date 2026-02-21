// apps/cli/src/ui/spinner.ts — progress spinner wrapper using ora
import ora from "ora";
import type { Ora } from "ora";

export interface Spinner {
  start(text: string): void;
  succeed(text: string): void;
  fail(text: string): void;
  stop(): void;
}

export function createSpinner(): Spinner {
  let instance: Ora | undefined;

  return {
    start(text: string) {
      instance = ora(text).start();
    },
    succeed(text: string) {
      instance?.succeed(text);
    },
    fail(text: string) {
      instance?.fail(text);
    },
    stop() {
      instance?.stop();
    },
  };
}
