/**
 * Unit tests for RequestFormatter
 */

import { describe, it, expect } from 'vitest';
import { RequestFormatter } from '../../../src/model-router/RequestFormatter.js';
import type { AIRequest } from '../../../src/core/interfaces/index.js';

describe('RequestFormatter', () => {
  let formatter: RequestFormatter;

  beforeEach(() => {
    formatter = new RequestFormatter();
  });

  describe('formatForOllama', () => {
    it('should format basic request', () => {
      const request: AIRequest = {
        prompt: 'test prompt',
        maxTokens: 100,
      };

      const formatted = formatter.formatForOllama(request);

      expect(formatted.model).toBe('deepseek-coder-v2');
      expect(formatted.prompt).toBe('test prompt');
      expect(formatted.stream).toBe(false);
      expect(formatted.options).toBeDefined();
    });

    it('should use custom model', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
        model: 'ollama:codellama',
      };

      const formatted = formatter.formatForOllama(request);

      expect(formatted.model).toBe('codellama');
    });

    it('should include temperature', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
        temperature: 0.5,
      };

      const formatted = formatter.formatForOllama(request);

      expect(formatted.options?.temperature).toBe(0.5);
    });

    it('should include stop sequences', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
        stopSequences: ['\n', '###'],
      };

      const formatted = formatter.formatForOllama(request);

      expect(formatted.options?.stop).toEqual(['\n', '###']);
    });

    it('should include context', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      const context = ['context 1', 'context 2'];

      const formatted = formatter.formatForOllama(request, context);

      expect(formatted.prompt).toContain('Context:');
      expect(formatted.prompt).toContain('context 1');
      expect(formatted.prompt).toContain('context 2');
      expect(formatted.prompt).toContain('Query:');
    });

    it('should use default temperature', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      const formatted = formatter.formatForOllama(request);

      expect(formatted.options?.temperature).toBe(0.7);
    });

    it('should use default max tokens', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: undefined,
      };

      const formatted = formatter.formatForOllama(request);

      expect(formatted.options?.num_predict).toBe(2048);
    });
  });

  describe('formatForClaude', () => {
    it('should format basic request', () => {
      const request: AIRequest = {
        prompt: 'test prompt',
        maxTokens: 100,
      };

      const formatted = formatter.formatForClaude(request);

      expect(formatted.model).toBe('claude-3-5-sonnet-20241022');
      expect(formatted.max_tokens).toBe(100);
      expect(formatted.messages).toHaveLength(1);
      expect(formatted.messages[0].role).toBe('user');
      expect(formatted.messages[0].content).toBe('test prompt');
    });

    it('should use custom model', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
        model: 'anthropic:claude-3-haiku',
      };

      const formatted = formatter.formatForClaude(request);

      expect(formatted.model).toBe('claude-3-haiku');
    });

    it('should include temperature', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
        temperature: 0.5,
      };

      const formatted = formatter.formatForClaude(request);

      expect(formatted.temperature).toBe(0.5);
    });

    it('should include stop sequences', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
        stopSequences: ['\n', '###'],
      };

      const formatted = formatter.formatForClaude(request);

      expect(formatted.stop_sequences).toEqual(['\n', '###']);
    });

    it('should include context', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      const context = ['context 1', 'context 2'];

      const formatted = formatter.formatForClaude(request, context);

      expect(formatted.messages[0].content).toContain('Context:');
      expect(formatted.messages[0].content).toContain('context 1');
      expect(formatted.messages[0].content).toContain('context 2');
      expect(formatted.messages[0].content).toContain('Query:');
    });

    it('should include anthropic version', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      const formatted = formatter.formatForClaude(request);

      expect(formatted.anthropic_version).toBe('2023-06-01');
    });
  });

  describe('formatForCloudflare', () => {
    it('should format basic request', () => {
      const request: AIRequest = {
        prompt: 'test prompt',
        maxTokens: 100,
      };

      const formatted = formatter.formatForCloudflare(request);

      expect(formatted.prompt).toBe('test prompt');
      expect(formatted.max_tokens).toBe(100);
    });

    it('should include temperature', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
        temperature: 0.5,
      };

      const formatted = formatter.formatForCloudflare(request);

      expect(formatted.temperature).toBe(0.5);
    });

    it('should include stop sequences', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
        stopSequences: ['\n', '###'],
      };

      const formatted = formatter.formatForCloudflare(request);

      expect(formatted.stop).toEqual(['\n', '###']);
    });

    it('should include context', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      const context = ['context 1', 'context 2'];

      const formatted = formatter.formatForCloudflare(request, context);

      expect(formatted.prompt).toContain('Context:');
      expect(formatted.prompt).toContain('context 1');
      expect(formatted.prompt).toContain('context 2');
      expect(formatted.prompt).toContain('Query:');
    });

    it('should use default max tokens', () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: undefined,
      };

      const formatted = formatter.formatForCloudflare(request);

      expect(formatted.max_tokens).toBe(2048);
    });
  });

  describe('formatOllamaResponse', () => {
    it('should format successful response', () => {
      const response = {
        response: 'generated text',
        prompt_eval_count: 10,
        eval_count: 20,
      };

      const formatted = formatter.formatOllamaResponse(response, 'test-model', 100);

      expect(formatted.text).toBe('generated text');
      expect(formatted.tokensUsed).toBe(30);
      expect(formatted.cost).toBe(0);
      expect(formatted.model).toBe('ollama:test-model');
      expect(formatted.duration).toBe(100);
    });

    it('should handle missing counts', () => {
      const response = {
        response: 'text',
      };

      const formatted = formatter.formatOllamaResponse(response, 'test-model', 100);

      expect(formatted.tokensUsed).toBe(0);
    });

    it('should handle missing response', () => {
      const response = {};

      const formatted = formatter.formatOllamaResponse(response, 'test-model', 100);

      expect(formatted.text).toBe('');
    });
  });

  describe('formatClaudeResponse', () => {
    it('should format successful response', () => {
      const response = {
        content: [{ text: 'generated text' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      };

      const formatted = formatter.formatClaudeResponse(response, 'test-model', 100);

      expect(formatted.text).toBe('generated text');
      expect(formatted.tokensUsed).toBe(150);
      expect(formatted.cost).toBeGreaterThan(0);
      expect(formatted.model).toBe('anthropic:test-model');
      expect(formatted.duration).toBe(100);
    });

    it('should calculate cost correctly', () => {
      const response = {
        content: [{ text: 'text' }],
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
        },
      };

      const formatted = formatter.formatClaudeResponse(response, 'test-model', 100, 3.0, 15.0);

      expect(formatted.cost).toBeCloseTo(0.0105, 4); // (1000/1M)*3 + (500/1M)*15
    });

    it('should handle missing usage', () => {
      const response = {
        content: [{ text: 'text' }],
      };

      const formatted = formatter.formatClaudeResponse(response, 'test-model', 100);

      expect(formatted.tokensUsed).toBe(0);
      expect(formatted.cost).toBe(0);
    });

    it('should handle missing content', () => {
      const response = {};

      const formatted = formatter.formatClaudeResponse(response, 'test-model', 100);

      expect(formatted.text).toBe('');
    });
  });

  describe('formatCloudflareResponse', () => {
    it('should format successful response with response field', () => {
      const response = {
        result: {
          response: 'generated text',
        },
      };

      const formatted = formatter.formatCloudflareResponse(response, 'test-model', 100);

      expect(formatted.text).toBe('generated text');
      expect(formatted.cost).toBe(0);
      expect(formatted.model).toBe('cloudflare:test-model');
      expect(formatted.duration).toBe(100);
    });

    it('should format successful response with text field', () => {
      const response = {
        result: {
          text: 'generated text',
        },
      };

      const formatted = formatter.formatCloudflareResponse(response, 'test-model', 100);

      expect(formatted.text).toBe('generated text');
    });

    it('should handle missing result', () => {
      const response = {};

      const formatted = formatter.formatCloudflareResponse(response, 'test-model', 100);

      expect(formatted.text).toBe('');
    });
  });

  describe('error extraction', () => {
    it('should extract Ollama error', () => {
      const response = { error: 'Ollama error' };

      const error = formatter.extractOllamaError(response);

      expect(error).toBe('Ollama error');
    });

    it('should return null for Ollama success', () => {
      const response = { response: 'text' };

      const error = formatter.extractOllamaError(response);

      expect(error).toBeNull();
    });

    it('should extract Claude error', () => {
      const response = {
        error: {
          message: 'Claude error',
          type: 'error_type',
        },
      };

      const error = formatter.extractClaudeError(response);

      expect(error).toBe('Claude error');
    });

    it('should return null for Claude success', () => {
      const response = {
        content: [{ text: 'text' }],
      };

      const error = formatter.extractClaudeError(response);

      expect(error).toBeNull();
    });

    it('should extract Cloudflare error', () => {
      const response = {
        errors: [
          { message: 'Cloudflare error', code: 400 },
        ],
      };

      const error = formatter.extractCloudflareError(response);

      expect(error).toBe('Cloudflare error');
    });

    it('should return null for Cloudflare success', () => {
      const response = {
        result: { response: 'text' },
        success: true,
      };

      const error = formatter.extractCloudflareError(response);

      expect(error).toBeNull();
    });
  });

  describe('success checks', () => {
    it('should check Ollama success', () => {
      const success = formatter.isOllamaSuccess({ response: 'text' });
      const failure = formatter.isOllamaSuccess({ error: 'error' });

      expect(success).toBe(true);
      expect(failure).toBe(false);
    });

    it('should check Claude success', () => {
      const success = formatter.isClaudeSuccess({
        content: [{ text: 'text' }],
      });
      const failure = formatter.isClaudeSuccess({
        error: { message: 'error', type: 'type' },
      });

      expect(success).toBe(true);
      expect(failure).toBe(false);
    });

    it('should check Cloudflare success', () => {
      const success = formatter.isCloudflareSuccess({
        result: { response: 'text' },
        success: true,
      });
      const failure = formatter.isCloudflareSuccess({
        errors: [{ message: 'error', code: 400 }],
      });

      expect(success).toBe(true);
      expect(failure).toBe(false);
    });
  });
});
