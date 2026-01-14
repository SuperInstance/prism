/**
 * Unit tests for ComplexityAnalyzer
 */

import { describe, it, expect } from 'vitest';
import { ComplexityAnalyzer } from '../../../src/model-router/ComplexityAnalyzer.js';

describe('ComplexityAnalyzer', () => {
  let analyzer: ComplexityAnalyzer;

  beforeEach(() => {
    analyzer = new ComplexityAnalyzer();
  });

  describe('analyze', () => {
    it('should return low complexity for simple queries', () => {
      const result = analyzer.analyze('what is a function');

      expect(result.score).toBeLessThan(0.5);
      expect(result.factors.length).toBeLessThan(0.5);
      expect(result.factors.keywords).toBeLessThan(0.5);
      expect(result.reasoning).toBeDefined();
    });

    it('should return high complexity for architecture queries', () => {
      const result = analyzer.analyze(
        'design a scalable microservice architecture with async message queues and implement distributed error handling'
      );

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.factors.keywords).toBeGreaterThan(0.3);
      expect(result.factors.structure).toBeGreaterThan(0.2);
      expect(result.reasoning).toContain('complex');
    });

    it('should analyze query length factor', () => {
      const short = analyzer.analyze('test');
      const long = analyzer.analyze('test '.repeat(100));

      expect(long.factors.length).toBeGreaterThan(short.factors.length);
    });

    it('should recognize code patterns', () => {
      const result = analyzer.analyze('implement async await pattern with promises');

      expect(result.factors.structure).toBeGreaterThan(0);
    });

    it('should detect ambiguity', () => {
      const result = analyzer.analyze('maybe do something somehow');

      expect(result.factors.ambiguity).toBeGreaterThan(0);
    });

    it('should analyze dependencies', () => {
      const result = analyzer.analyze('import React from "react"', {
        currentFile: '/home/user/project/App.tsx',
      });

      expect(result.factors.dependencies).toBeGreaterThan(0);
    });

    it('should normalize score to 0-1 range', () => {
      const results = [
        analyzer.analyze('simple'),
        analyzer.analyze('complex ' * 1000),
        analyzer.analyze('test'),
      ];

      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });

    it('should provide detailed factor breakdown', () => {
      const result = analyzer.analyze('implement function with class');

      expect(result.factors).toHaveProperty('length');
      expect(result.factors).toHaveProperty('keywords');
      expect(result.factors).toHaveProperty('structure');
      expect(result.factors).toHaveProperty('dependencies');
      expect(result.factors).toHaveProperty('ambiguity');
    });

    it('should recognize high complexity keywords', () => {
      const keywords = [
        'architecture',
        'optimize',
        'refactor',
        'debug',
        'implement',
        'integration',
      ];

      for (const keyword of keywords) {
        const result = analyzer.analyze(`help me ${keyword} my code`);
        expect(result.factors.keywords).toBeGreaterThan(0);
      }
    });

    it('should recognize low complexity keywords', () => {
      const result = analyzer.analyze('what is a simple example');

      expect(result.factors.keywords).toBeLessThan(0.5);
    });

    it('should increase complexity with multiple questions', () => {
      const single = analyzer.analyze('what is this?');
      const multiple = analyzer.analyze('what is this? how does it work? why use it?');

      expect(multiple.factors.structure).toBeGreaterThan(single.factors.structure);
    });

    it('should detect code blocks', () => {
      const result = analyzer.analyze('```javascript\nconst x = 1;\n```');

      expect(result.factors.structure).toBeGreaterThan(0);
    });

    it('should handle empty query', () => {
      const result = analyzer.analyze('');

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should handle special characters', () => {
      const result = analyzer.analyze('function @#$%^&*() {}[]');

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('reasoning', () => {
    it('should identify simple queries', () => {
      const result = analyzer.analyze('what is a function');

      expect(result.reasoning.toLowerCase()).toContain('simple');
    });

    it('should identify moderately complex queries', () => {
      const result = analyzer.analyze('create a function with error handling');

      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should identify highly complex queries', () => {
      const result = analyzer.analyze(
        'design a distributed microservice architecture with async message queues, implement error handling, optimize performance, and add comprehensive testing'
      );

      expect(result.reasoning.toLowerCase()).toMatch(/complex|high/);
    });

    it('should mention dominant factors', () => {
      const result = analyzer.analyze(
        'design architecture and optimize performance with debug and testing'
      );

      expect(result.reasoning).toMatch(/keyword|pattern|structure/);
    });
  });
});
