/**
 * Unit tests for IntentDetector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IntentDetector } from '../../../src/token-optimizer/IntentDetector.js';
import type { Message } from '../../../src/token-optimizer/types.js';

describe('IntentDetector', () => {
  let detector: IntentDetector;

  beforeEach(() => {
    detector = new IntentDetector();
  });

  describe('detect', () => {
    it('should detect bug_fix intent', async () => {
      const prompt = 'There is a bug in the authentication system';

      const intent = await detector.detect(prompt);

      expect(intent.type).toBe('bug_fix');
      expect(intent.query).toBe(prompt);
    });

    it('should detect feature_add intent', async () => {
      const prompt = 'Add a new feature for user profiles';

      const intent = await detector.detect(prompt);

      expect(intent.type).toBe('feature_add');
    });

    it('should detect explain intent', async () => {
      const prompt = 'Explain how the token optimizer works';

      const intent = await detector.detect(prompt);

      expect(intent.type).toBe('explain');
    });

    it('should detect refactor intent', async () => {
      const prompt = 'Refactor the authentication code to be cleaner';

      const intent = await detector.detect(prompt);

      expect(intent.type).toBe('refactor');
    });

    it('should detect test intent', async () => {
      const prompt = 'Write tests for the user service';

      const intent = await detector.detect(prompt);

      expect(intent.type).toBe('test');
    });

    it('should detect search intent', async () => {
      const prompt = 'Find all functions that use the database';

      const intent = await detector.detect(prompt);

      expect(intent.type).toBe('search');
    });

    it('should default to general for unknown intents', async () => {
      const prompt = 'Hello, good morning today';

      const intent = await detector.detect(prompt);

      expect(intent.type).toBe('general');
    });

    it('should extract symbols from backticks', async () => {
      const prompt = 'Explain the `formatDate` function';

      const intent = await detector.detect(prompt);

      const symbols = intent.entities.filter(e => e.type === 'symbol');
      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols[0].value.toLowerCase()).toBe('formatdate');
      expect(symbols[0].confidence).toBeGreaterThan(0.8);
    });

    it('should extract file paths', async () => {
      const prompt = 'Show me utils.ts';

      const intent = await detector.detect(prompt);

      const fileEntities = intent.entities.filter(e => e.type === 'file');
      expect(fileEntities.length).toBeGreaterThan(0);
      expect(fileEntities[0].value).toContain('.ts');
    });

    it('should extract keywords', async () => {
      const prompt = 'Create a new function in the class';

      const intent = await detector.detect(prompt);

      const keywords = intent.entities.filter(e => e.type === 'keyword');
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('should determine current_file scope', async () => {
      const prompt = 'Fix the bug in this file';

      const intent = await detector.detect(prompt);

      expect(intent.scope).toBe('current_file');
    });

    it('should determine current_dir scope', async () => {
      const prompt = 'What functions are in this directory?';

      const intent = await detector.detect(prompt);

      expect(intent.scope).toBe('current_dir');
    });

    it('should determine project scope', async () => {
      const prompt = 'Find all database queries in the project';

      const intent = await detector.detect(prompt);

      expect(intent.scope).toBe('project');
    });

    it('should calculate complexity based on length', async () => {
      const simplePrompt = 'Fix bug';
      const complexPrompt = 'Fix the authentication bug in the user service when handling OAuth tokens and add proper error handling';

      const simpleIntent = await detector.detect(simplePrompt);
      const complexIntent = await detector.detect(complexPrompt);

      expect(complexIntent.complexity).toBeGreaterThan(simpleIntent.complexity);
    });

    it('should calculate complexity based on entities', async () => {
      const noEntitiesPrompt = 'Fix the bug';
      const withEntitiesPrompt = 'Fix the `AuthService` in `auth.ts` which uses `User` type';

      const noEntitiesIntent = await detector.detect(noEntitiesPrompt);
      const withEntitiesIntent = await detector.detect(withEntitiesPrompt);

      expect(withEntitiesIntent.complexity).toBeGreaterThan(noEntitiesIntent.complexity);
    });

    it('should detect need for history with anaphora', async () => {
      const prompt = 'How does it work?';

      const intent = await detector.detect(prompt);

      expect(intent.requiresHistory).toBe(true);
    });

    it('should detect need for history with follow-up', async () => {
      const prompt = 'Also add error handling';

      const intent = await detector.detect(prompt);

      expect(intent.requiresHistory).toBe(true);
    });

    it('should not require history for standalone queries', async () => {
      const prompt = 'Explain the formatDate function';

      const intent = await detector.detect(prompt);

      expect(intent.requiresHistory).toBe(false);
    });

    it('should estimate budget based on intent type', async () => {
      const bugFixIntent = await detector.detect('Fix the bug');
      const explainIntent = await detector.detect('Explain the code');

      expect(bugFixIntent.estimatedBudget).toBeGreaterThan(explainIntent.estimatedBudget);
    });

    it('should estimate budget based on scope', async () => {
      const fileScopeIntent = await detector.detect('Fix this file');
      const projectScopeIntent = await detector.detect('Fix all files in the project');

      expect(projectScopeIntent.estimatedBudget).toBeGreaterThan(fileScopeIntent.estimatedBudget);
    });

    it('should determine optimization options', async () => {
      const intent = await detector.detect('Refactor the code');

      expect(intent.options).toBeDefined();
      expect(intent.options.maxChunks).toBeGreaterThan(0);
      expect(intent.options.minRelevance).toBeGreaterThanOrEqual(0);
      expect(intent.options.compressionLevel).toBeDefined();
    });

    it('should prefer diversity for project scope', async () => {
      const projectIntent = await detector.detect('Find functions in the project');

      expect(projectIntent.options.preferDiversity).toBe(true);
    });

    it('should not prefer diversity for file scope', async () => {
      const fileIntent = await detector.detect('Fix the bug in this file');

      expect(fileIntent.options.preferDiversity).toBe(false);
    });

    it('should use light compression for simple queries', async () => {
      const simpleIntent = await detector.detect('Fix bug');

      expect(simpleIntent.options.compressionLevel).toBe('light');
    });

    it('should use medium or aggressive compression for complex queries', async () => {
      const complexIntent = await detector.detect(
        'Refactor the entire authentication system architecture design pattern algorithm implementation'
      );

      expect(['medium', 'aggressive']).toContain(complexIntent.options.compressionLevel);
    });
  });

  describe('intent classification accuracy', () => {
    it('should correctly classify bug-related queries', async () => {
      const bugQueries = [
        'There is a bug',
        'Fix the error',
        'The code is broken',
        'Debug this issue',
      ];

      for (const query of bugQueries) {
        const intent = await detector.detect(query);
        expect(intent.type).toBe('bug_fix');
      }
    });

    it('should correctly classify feature-related queries', async () => {
      const featureQueries = [
        'Add a new feature',
        'Implement user authentication',
        'Create a new component',
        'Build a REST API',
      ];

      for (const query of featureQueries) {
        const intent = await detector.detect(query);
        expect(intent.type).toBe('feature_add');
      }
    });

    it('should correctly classify explanation queries', async () => {
      const explainQueries = [
        'How does this work?',
        'Explain the algorithm',
        'What does this function do?',
        'Describe the architecture',
      ];

      for (const query of explainQueries) {
        const intent = await detector.detect(query);
        expect(intent.type).toBe('explain');
      }
    });
  });

  describe('entity extraction accuracy', () => {
    it('should extract multiple symbols', async () => {
      const prompt = 'Compare `formatDate` and `parseDate`';

      const intent = await detector.detect(prompt);

      const symbols = intent.entities.filter(e => e.type === 'symbol');
      expect(symbols).toHaveLength(2);
    });

    it('should handle quoted symbols', async () => {
      const prompt = 'Explain the "AuthService" class';

      const intent = await detector.detect(prompt);

      const symbols = intent.entities.filter(e => e.type === 'symbol');
      expect(symbols.length).toBeGreaterThan(0);
    });

    it('should extract multiple file paths', async () => {
      const prompt = 'Show me utils.ts and helpers.ts';

      const intent = await detector.detect(prompt);

      const files = intent.entities.filter(e => e.type === 'file');
      expect(files.length).toBeGreaterThan(0);
    });

    it('should extract multiple unique entities', async () => {
      const prompt = 'Compare `AuthService` and `UserService` classes';

      const intent = await detector.detect(prompt);

      // Should extract entities (symbols, types, or keywords)
      expect(intent.entities.length).toBeGreaterThan(0);
    });
  });

  describe('complexity calculation', () => {
    it('should increase complexity for multi-step queries', async () => {
      const singleStep = await detector.detect('Fix the bug');
      const multiStep = await detector.detect('Fix the bug and then add tests and also update documentation');

      expect(multiStep.complexity).toBeGreaterThan(singleStep.complexity);
    });

    it('should increase complexity for technical terms', async () => {
      const simple = await detector.detect('Fix the code');
      const technical = await detector.detect('Refactor the algorithm implementation');

      expect(technical.complexity).toBeGreaterThan(simple.complexity);
    });

    it('should respect maximum complexity of 1.0', async () => {
      const veryComplex = 'Implement ' +
        'refactor and test and optimize and document ' +
        'the complex algorithm architecture design pattern ' +
        'with error handling and logging and monitoring ' +
        'for the UserService and AuthService and AdminService';

      const intent = await detector.detect(veryComplex);

      expect(intent.complexity).toBeLessThanOrEqual(1.0);
    });
  });

  describe('budget estimation', () => {
    it('should provide reasonable budgets', async () => {
      const intents = await Promise.all([
        detector.detect('Fix bug'),
        detector.detect('Add feature'),
        detector.detect('Explain code'),
        detector.detect('Refactor code'),
      ]);

      for (const intent of intents) {
        expect(intent.estimatedBudget).toBeGreaterThan(0);
        expect(intent.estimatedBudget).toBeLessThan(20000);
      }
    });

    it('should scale budget with complexity', async () => {
      const simple = await detector.detect('Fix bug');
      const complex = await detector.detect(
        'Refactor the authentication system and add comprehensive error handling'
      );

      expect(complex.estimatedBudget).toBeGreaterThan(simple.estimatedBudget);
    });
  });
});
