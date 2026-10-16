// Opens the HTML report of the most recent browser-test run (npm run test:report).
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const runs = join(process.cwd(), "tests", "reports", "runs");
if (!existsSync(runs)) {
  console.log("No test reports yet. Run a browser test first (npm run test:e2e).");
  process.exit(0);
}
const latest = readdirSync(runs)
  .map((d) => ({ d, t: statSync(join(runs, d)).mtimeMs }))
  .filter(({ d }) => existsSync(join(runs, d, "html", "index.html")))
  .sort((a, b) => b.t - a.t)[0];
if (!latest) {
  console.log("No HTML report found yet.");
  process.exit(0);
}
console.log(`Opening report for run ${latest.d}`);
spawn("npx", ["playwright", "show-report", join(runs, latest.d, "html")], { stdio: "inherit", shell: true });
