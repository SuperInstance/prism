/**
 * Complex TypeScript module for testing
 */

import { Calculator } from './class-with-methods.js';

// Types
export type Operation = 'add' | 'subtract' | 'multiply' | 'divide';

export interface CalculationResult {
  value: number;
  operation: Operation;
  timestamp: Date;
}

export interface HistoryEntry {
  calculation: CalculationResult;
  id: string;
}

// Constants
export const MAX_HISTORY_SIZE = 100;
export const DEFAULT_PRECISION = 2;

// Utility functions
export function formatNumber(num: number, precision: number = DEFAULT_PRECISION): string {
  return num.toFixed(precision);
}

export function isValidOperation(op: string): op is Operation {
  return ['add', 'subtract', 'multiply', 'divide'].includes(op);
}

// Main class
export class HistoryCalculator {
  private calculator: Calculator;
  private history: HistoryEntry[];
  private maxHistorySize: number;

  constructor(maxHistorySize: number = MAX_HISTORY_SIZE) {
    this.calculator = new Calculator();
    this.history = [];
    this.maxHistorySize = maxHistorySize;
  }

  perform(operation: Operation, value: number): CalculationResult {
    switch (operation) {
      case 'add':
        this.calculator.add(value);
        break;
      case 'subtract':
        this.calculator.subtract(value);
        break;
      case 'multiply':
        this.calculator.multiply(value);
        break;
      case 'divide':
        this.calculator.divide(value);
        break;
    }

    const result: CalculationResult = {
      value: this.calculator.getResult(),
      operation,
      timestamp: new Date(),
    };

    this.addToHistory(result);

    return result;
  }

  private addToHistory(result: CalculationResult): void {
    const entry: HistoryEntry = {
      calculation: result,
      id: this.generateId(),
    };

    this.history.push(entry);

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  private generateId(): string {
    return `calc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  getCurrentValue(): number {
    return this.calculator.getResult();
  }

  reset(): void {
    this.calculator.reset();
    this.clearHistory();
  }
}

// Factory function
export function createCalculator(maxHistory?: number): HistoryCalculator {
  return new HistoryCalculator(maxHistory);
}

// Validation function
export function validateCalculationInput(value: number, operation: Operation): boolean {
  if (isNaN(value)) {
    return false;
  }

  if (operation === 'divide' && value === 0) {
    return false;
  }

  return true;
}
