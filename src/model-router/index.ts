/**
 * Model Router Module
 *
 * Exports all model routing components for intelligent AI model selection.
 */

export { ModelRouter } from './ModelRouter.js';
export type { ModelRouterConfig } from './ModelRouter.js';

export { ComplexityAnalyzer } from './ComplexityAnalyzer.js';
export type { ComplexityResult, QueryContext } from './ComplexityAnalyzer.js';

export { BudgetTracker, DAILY_NEURON_LIMIT } from './BudgetTracker.js';
export function createBudgetTracker(persistEnabled?: boolean) {
  const { BudgetTracker: BT } = import('./BudgetTracker.js');
  return new BT(persistEnabled);
}

export { RequestFormatter } from './RequestFormatter.js';
export type {
  OllamaRequest,
  OllamaResponse,
  ClaudeRequest,
  ClaudeResponse,
  CloudflareRequest,
  CloudflareResponse,
} from './RequestFormatter.js';

export { OllamaClient } from './OllamaClient.js';
export type { OllamaClientConfig, OllamaModel } from './OllamaClient.js';

export { CloudflareClient } from './CloudflareClient.js';
export type { CloudflareClientConfig } from './CloudflareClient.js';
