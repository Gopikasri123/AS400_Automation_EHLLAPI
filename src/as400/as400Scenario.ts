import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Runs the Python AS400 (PUB400, EHLLAPI) scenario `as400/scenarios/gep_order_check.py` from a Playwright test.
 * The scenario drives the ACS 5250 green screen: it records the website order in the ORDERS table, reads it back
 * with STRSQL and scrapes a Main Menu option. It writes its result to a JSON file, which this helper returns.
 *
 * Environment (all optional): AS400_DIR (default ./as400), AS400_PYTHON (default python).
 * The PUB400 password comes from PUB400_PASSWORD (read by the Python framework, never passed on the command line).
 */
export type As400Step = { step: string; status: string; expected: string; actual: string; statement: string };

export type As400OrderCheckResult = {
  passed: boolean;
  table: string;
  order: Record<string, string | null> | null;
  menu: { option?: number; text?: string; title?: string; all_options?: Record<string, string>; screen?: string[] };
  steps: As400Step[];
  reports: { csv: string; html: string };
};

export type As400OrderInput = {
  orderNumber: string;
  productId: string;
  /** ORDER_STATUS (VARCHAR(20): longer statuses are cut to 20 characters by the scenario) */
  orderStatus: string;
  /** ORDER_DATE as YYYY-MM-DD */
  orderDate: string;
  menuOption: number;
};

const AS400_DIR = path.resolve(process.env.AS400_DIR || 'as400');
const PYTHON = process.env.AS400_PYTHON || 'python';
// Sign-on, STRSQL and sign-off on PUB400 take a minute or two; give the green screen up to 6 minutes.
const AS400_TIMEOUT_MS = 6 * 60 * 1000;

export async function runAs400OrderCheck(input: As400OrderInput, outFile: string): Promise<As400OrderCheckResult> {
  if (!fs.existsSync(AS400_DIR)) throw new Error(`AS400 project folder not found: ${AS400_DIR} (set AS400_DIR)`);
  if (!process.env.PUB400_PASSWORD) {
    throw new Error('PUB400_PASSWORD is not set: the AS400 sign-on needs it (the green screen cannot prompt inside a test).');
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.rmSync(outFile, { force: true });

  const args = [
    '-m', 'scenarios.gep_order_check',
    '--order', input.orderNumber,
    '--product', input.productId,
    '--status', input.orderStatus,
    '--order-date', input.orderDate,
    '--menu-option', String(input.menuOption),
    '--out', outFile,
  ];

  // No shell: every argument reaches Python exactly as written. stdout/stderr are shown live in the test output.
  const code = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(PYTHON, args, { cwd: AS400_DIR, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: false });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`AS400 scenario did not finish within ${AS400_TIMEOUT_MS / 60000} minutes`));
    }, AS400_TIMEOUT_MS);
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('exit', (exitCode) => { clearTimeout(timer); resolve(exitCode); });
  });

  if (!fs.existsSync(outFile)) {
    throw new Error(`AS400 scenario exited with code ${code} and wrote no result file (see the Python output above).`);
  }
  return JSON.parse(fs.readFileSync(outFile, 'utf-8')) as As400OrderCheckResult;
}

/** One line per AS400 step, for an error message or the report. */
export function describeAs400Steps(result: As400OrderCheckResult): string {
  return result.steps.map((s) => `[${s.status}] ${s.step} | ${s.actual}`).join('\n');
}
