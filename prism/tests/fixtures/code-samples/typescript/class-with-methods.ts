/**
 * TypeScript class with methods for testing
 */

export class Calculator {
  private result: number;

  constructor(initialValue: number = 0) {
    this.result = initialValue;
  }

  add(value: number): this {
    this.result += value;
    return this;
  }

  subtract(value: number): this {
    this.result -= value;
    return this;
  }

  multiply(value: number): this {
    this.result *= value;
    return this;
  }

  divide(value: number): this {
    if (value === 0) {
      throw new Error('Cannot divide by zero');
    }
    this.result /= value;
    return this;
  }

  getResult(): number {
    return this.result;
  }

  reset(): void {
    this.result = 0;
  }
}

export class ScientificCalculator extends Calculator {
  square(): this {
    this.result = this.result * this.result;
    return this;
  }

  squareRoot(): this {
    if (this.result < 0) {
      throw new Error('Cannot calculate square root of negative number');
    }
    this.result = Math.sqrt(this.result);
    return this;
  }

  power(exponent: number): this {
    this.result = Math.pow(this.result, exponent);
    return this;
  }
}
