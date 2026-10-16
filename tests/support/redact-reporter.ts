// Runs first among the reporters: after every test it deletes any attachment that could hold
// page content (page snapshots, screenshots, videos, traces) and removes it from the result,
// so no later report copies it. The sandbox holds real data, so failure evidence is limited to
// the error message, the test step and the network-guard log.
import { rmSync } from "node:fs";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

const SENSITIVE = (a: TestResult["attachments"][number]) =>
  a.name === "error-context" ||
  a.name === "trace" ||
  a.contentType.startsWith("image/") ||
  a.contentType.startsWith("video/") ||
  a.contentType === "application/zip";

export default class RedactReporter implements Reporter {
  onTestEnd(_test: TestCase, result: TestResult) {
    for (let i = result.attachments.length - 1; i >= 0; i--) {
      const a = result.attachments[i];
      if (!SENSITIVE(a)) continue;
      if (a.path) rmSync(a.path, { force: true });
      result.attachments.splice(i, 1);
    }
  }

  printsToStdio() {
    return false;
  }
}
