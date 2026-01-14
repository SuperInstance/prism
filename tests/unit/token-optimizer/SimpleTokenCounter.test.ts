/**
 * Unit tests for SimpleTokenCounter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleTokenCounter } from '../../../src/token-optimizer/SimpleTokenCounter.js';

describe('SimpleTokenCounter', () => {
  let counter: SimpleTokenCounter;

  beforeEach(() => {
    counter = new SimpleTokenCounter();
  });

  describe('estimate', () => {
    it('should return 0 for empty string', () => {
      expect(counter.estimate('')).toBe(0);
    });

    it('should estimate tokens for simple text', () => {
      const text = 'Hello world!';
      const tokens = counter.estimate(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should estimate tokens for code', () => {
      const code = 'function test() { return 42; }';
      const tokens = counter.estimate(code);

      expect(tokens).toBeGreaterThan(0);
      // Code should have different tokenization than text
    });

    it('should handle long text', () => {
      const text = 'Hello '.repeat(100);
      const tokens = counter.estimate(text);

      expect(tokens).toBeGreaterThan(100);
    });

    it('should handle TypeScript code', () => {
      const code = `
        interface User {
          id: number;
          name: string;
          email: string;
        }

        async function getUser(id: number): Promise<User> {
          const response = await fetch(\`/api/users/\${id}\`);
          return response.json();
        }
      `;

      const tokens = counter.estimate(code);

      expect(tokens).toBeGreaterThan(0);
      // Code should be estimated more densely
      expect(tokens).toBeLessThan(code.length / 2);
    });

    it('should handle Python code', () => {
      const code = `
        class DataProcessor:
            def __init__(self, data: List[str]):
                self.data = data

            def process(self) -> Dict[str, int]:
                return {item: len(item) for item in self.data}
      `;

      const tokens = counter.estimate(code);

      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('estimateBatch', () => {
    it('should estimate multiple texts', () => {
      const texts = ['Hello world', 'foo bar baz', 'test'];

      const results = counter.estimateBatch(texts);

      expect(results).toHaveLength(3);
      expect(results.every((t) => t > 0)).toBe(true);
    });

    it('should handle empty array', () => {
      const results = counter.estimateBatch([]);

      expect(results).toEqual([]);
    });

    it('should handle empty strings in batch', () => {
      const texts = ['Hello', '', 'World'];

      const results = counter.estimateBatch(texts);

      expect(results).toEqual([expect.any(Number), 0, expect.any(Number)]);
    });
  });

  describe('countTokens', () => {
    it('should be alias for estimate', () => {
      const text = 'Hello world';

      const estimate = counter.estimate(text);
      const count = counter.countTokens(text);

      expect(estimate).toBe(count);
    });
  });

  describe('estimateJSONTokens', () => {
    it('should estimate JSON object tokens', () => {
      const obj = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      };

      const tokens = counter.estimateJSONTokens(obj);

      expect(tokens).toBeGreaterThan(0);
    });

    it('should estimate nested JSON', () => {
      const obj = {
        user: {
          name: 'Jane',
          address: {
            city: 'NYC',
            country: 'USA',
          },
        },
      };

      const tokens = counter.estimateJSONTokens(obj);

      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('getEstimationBreakdown', () => {
    it('should provide breakdown for text', () => {
      const text = 'Hello world! This is a test.';

      const breakdown = counter.getEstimationBreakdown(text);

      expect(breakdown.type).toBe('text');
      expect(breakdown.total).toBeGreaterThan(0);
      expect(breakdown.details.characters).toBe(text.length);
      expect(breakdown.details.final).toBe(breakdown.total);
    });

    it('should provide breakdown for code', () => {
      const code = 'function test() { return true; }';

      const breakdown = counter.getEstimationBreakdown(code);

      expect(breakdown.type).toBe('code');
      expect(breakdown.total).toBeGreaterThan(0);
    });

    it('should include adjustment details', () => {
      const text = 'Check out https://example.com for more info';

      const breakdown = counter.getEstimationBreakdown(text);

      expect(breakdown.details.adjustments).toBeDefined();
      expect(typeof breakdown.details.adjustments).toBe('number');
    });
  });

  describe('estimateBatchTotal', () => {
    it('should sum total tokens for batch', () => {
      const texts = ['Hello', 'world', 'test'];

      const total = counter.estimateBatchTotal(texts);
      const individual = counter.estimateBatch(texts);
      const sum = individual.reduce((a, b) => a + b, 0);

      expect(total).toBe(sum);
    });

    it('should return 0 for empty array', () => {
      const total = counter.estimateBatchTotal([]);

      expect(total).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace', () => {
      expect(counter.estimate('   ')).toBe(0);
      expect(counter.estimate('\n\n\n')).toBe(0);
      expect(counter.estimate('\t\t\t')).toBe(0);
    });

    it('should handle special characters', () => {
      const text = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';

      const tokens = counter.estimate(text);

      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle emoji', () => {
      const text = 'Hello 👋 World 🌍';

      const tokens = counter.estimate(text);

      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle mixed content', () => {
      const content = `
        // This is a comment explaining the function
        function processData(data: string[]): number {
          return data.filter(x => x).length;
        }
      `;

      const tokens = counter.estimate(content);

      expect(tokens).toBeGreaterThan(0);
    });
  });
});
