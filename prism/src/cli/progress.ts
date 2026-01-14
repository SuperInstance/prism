/**
 * Progress Display Utilities for Prism CLI
 *
 * Provides spinners and progress bars for CLI operations
 */

import ora from 'ora';
import type { Ora } from 'ora';
import chalk from 'chalk';
import { SingleBar } from 'cli-progress';

/**
 * Spinner for async operations
 */
export class Spinner {
  private spinner: Ora | null = null;
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  /**
   * Start a spinner with a message
   */
  start(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray(`[START] ${message}`));
      return;
    }

    this.spinner = ora({
      text: message,
      color: 'cyan',
      spinner: 'dots',
    }).start();
  }

  /**
   * Update the spinner message
   */
  update(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray(`[UPDATE] ${message}`));
      return;
    }

    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  /**
   * Mark spinner as succeeded
   */
  succeed(message?: string): void {
    if (this.verbose) {
      console.log(chalk.green(`[DONE] ${message || 'Complete'}`));
      return;
    }

    if (this.spinner) {
      if (message) {
        this.spinner.succeed(message);
      } else {
        this.spinner.succeed();
      }
      this.spinner = null;
    }
  }

  /**
   * Mark spinner as failed
   */
  fail(message?: string): void {
    if (this.verbose) {
      console.error(chalk.red(`[FAIL] ${message || 'Failed'}`));
      return;
    }

    if (this.spinner) {
      if (message) {
        this.spinner.fail(message);
      } else {
        this.spinner.fail();
      }
      this.spinner = null;
    }
  }

  /**
   * Display an info message
   */
  info(message: string): void {
    if (this.verbose) {
      console.log(chalk.blue(`[INFO] ${message}`));
      return;
    }

    if (this.spinner) {
      this.spinner.info(message);
    } else {
      console.log(chalk.blue(message));
    }
  }

  /**
   * Display a warning message
   */
  warn(message: string): void {
    if (this.verbose) {
      console.warn(chalk.yellow(`[WARN] ${message}`));
      return;
    }

    if (this.spinner) {
      this.spinner.warn(message);
    } else {
      console.warn(chalk.yellow(message));
    }
  }

  /**
   * Stop the spinner without success/fail message
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }
}

/**
 * Progress bar for tracking long-running operations
 */
export class ProgressBar {
  private bar: SingleBar | null = null;
  private verbose: boolean;
  private current: number = 0;
  private total: number = 0;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  /**
   * Start a new progress bar
   */
  start(message: string, total: number): void {
    this.total = total;
    this.current = 0;

    if (this.verbose) {
      console.log(chalk.gray(`[PROGRESS] ${message} (0/${total})`));
      return;
    }

    this.bar = new SingleBar({
      format: `${chalk.cyan('{bar}')} | {percentage}% | {value}/{total} | {message}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    this.bar.start(total, 0, { message });
  }

  /**
   * Update the progress bar
   */
  update(current: number, message?: string): void {
    this.current = current;

    if (this.verbose) {
      if (message) {
        console.log(chalk.gray(`[PROGRESS] ${message} (${current}/${this.total})`));
      }
      return;
    }

    if (this.bar) {
      this.bar.update(current, { message: message || '' });
    }
  }

  /**
   * Increment the progress by 1
   */
  increment(message?: string): void {
    this.update(this.current + 1, message);
  }

  /**
   * Mark the progress bar as complete
   */
  complete(message?: string): void {
    if (this.verbose) {
      console.log(chalk.green(`[COMPLETE] ${message || 'Done'} (${this.total}/${this.total})`));
      return;
    }

    if (this.bar) {
      this.bar.update(this.total, { message: message || '' });
      this.bar.stop();
      this.bar = null;
    }
  }

  /**
   * Stop the progress bar
   */
  stop(): void {
    if (this.bar) {
      this.bar.stop();
      this.bar = null;
    }
  }
}

/**
 * Create a spinner instance
 */
export function createSpinner(verbose?: boolean): Spinner {
  return new Spinner(verbose);
}

/**
 * Create a progress bar instance
 */
export function createProgressBar(verbose?: boolean): ProgressBar {
  return new ProgressBar(verbose);
}

/**
 * Display a simple text progress (for very simple cases)
 */
export class TextProgress {
  private verbose: boolean;
  private total: number;
  private current: number = 0;

  constructor(total: number, verbose: boolean = false) {
    this.total = total;
    this.verbose = verbose;
  }

  /**
   * Increment progress
   */
  increment(): void {
    this.current++;
    const percentage = Math.round((this.current / this.total) * 100);

    if (this.verbose) {
      console.log(chalk.gray(`Progress: ${this.current}/${this.total} (${percentage}%)`));
    } else if (this.current % Math.max(1, Math.floor(this.total / 10)) === 0 || this.current === this.total) {
      // Print every 10% or when complete
      process.stdout.write(`\r${percentage}%`);
      if (this.current === this.total) {
        process.stdout.write('\n');
      }
    }
  }

  /**
   * Update progress to specific value
   */
  update(value: number): void {
    this.current = value;
    const percentage = Math.round((this.current / this.total) * 100);

    if (this.verbose) {
      console.log(chalk.gray(`Progress: ${this.current}/${this.total} (${percentage}%)`));
    } else {
      process.stdout.write(`\r${percentage}%`);
      if (this.current === this.total) {
        process.stdout.write('\n');
      }
    }
  }

  /**
   * Complete the progress
   */
  complete(): void {
    this.current = this.total;
    if (!this.verbose) {
      process.stdout.write('\r100%\n');
    } else {
      console.log(chalk.green('Complete!'));
    }
  }
}
