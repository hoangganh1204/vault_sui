/* eslint-disable no-console */
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import Table from 'cli-table3';
import type { VaultSuiError } from './errors.js';

const DIVIDER = '──────────────────────────────────────';

export function header(title = 'VaultSui 🔐'): void {
  console.log(chalk.bold.cyan(title));
  divider();
}

export function divider(): void {
  console.log(chalk.gray(DIVIDER));
}

export function step(message: string, detail?: string): void {
  const prefix = chalk.green('✔');
  const tail = detail ? `   ${chalk.gray(detail)}` : '';
  console.log(`${prefix} ${message}${tail}`);
}

export function success(message: string, details?: Record<string, string>): void {
  console.log('');
  console.log(`${chalk.green('✅')} ${chalk.bold(message)}`);
  if (details) {
    console.log('');
    for (const [key, value] of Object.entries(details)) {
      console.log(`  ${chalk.bold(`${key}:`.padEnd(12))} ${value}`);
    }
  }
}

export function error(message: string, err?: VaultSuiError): void {
  console.log('');
  console.log(`${chalk.red('❌')} ${chalk.bold(message)}`);
  if (err) {
    console.log('');
    console.log(`  ${chalk.bold('Fix: '.padEnd(6))} ${err.fix}`);
    console.log(`  ${chalk.bold('Code:'.padEnd(6))} ${chalk.red(err.code)}`);
  }
}

export function spinner(text: string): Ora {
  return ora({ text, color: 'cyan' }).start();
}

export function table(head: string[], rows: string[][]): void {
  const t = new Table({
    head: head.map((h) => chalk.bold(h)),
    style: { head: [], border: ['gray'] },
  });
  for (const row of rows) {
    t.push(row);
  }
  console.log(t.toString());
}

export function info(message: string): void {
  console.log(message);
}
