/**
 * Health Monitor
 *
 * Monitors Ollama health and tracks metrics.
 */

import { OllamaClient } from './OllamaClient.js';
import type { HealthStatus, HealthMetrics } from './types.js';

/**
 * Health monitor configuration
 */
export interface HealthMonitorConfig {
  /** Health check interval in milliseconds */
  checkInterval: number;
  /** Maximum latency threshold in milliseconds */
  maxLatency: number;
  /** Maximum error rate threshold (0-1) */
  maxErrorRate: number;
  /** Number of requests to keep in history */
  historySize: number;
}

/**
 * Default health monitor configuration
 */
const DEFAULT_CONFIG: HealthMonitorConfig = {
  checkInterval: 30000, // 30 seconds
  maxLatency: 5000, // 5 seconds
  maxErrorRate: 0.1, // 10%
  historySize: 1000,
};

/**
 * Request history entry
 */
interface RequestEntry {
  timestamp: Date;
  success: boolean;
  latency: number;
}

/**
 * Ollama health monitor
 */
export class OllamaHealthMonitor {
  private client: OllamaClient;
  private config: HealthMonitorConfig;
  private metrics: HealthMetrics;
  private requestHistory: RequestEntry[] = [];
  private monitoringInterval: NodeJS.Timeout | undefined;
  private isMonitoring = false;

  constructor(client?: OllamaClient, config?: Partial<HealthMonitorConfig>) {
    this.client = client || new OllamaClient();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = this.initializeMetrics();
  }

  /**
   * Perform a health check
   */
  async check(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      // Check if Ollama is available
      const isAvailable = await this.client.isAvailable();

      if (!isAvailable) {
        return {
          available: false,
          error: 'Ollama is not reachable',
        };
      }

      // Get version
      const version = await this.client.getVersion();

      // Get loaded models
      const models = await this.client.listModels();

      const latency = Date.now() - startTime;
      this.recordRequest(true, latency);

      return {
        available: true,
        version,
        loadedModels: models.length,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordRequest(false, latency);

      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Start periodic health monitoring
   */
  async startMonitoring(interval?: number): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    const checkInterval = interval || this.config.checkInterval;

    // Perform initial check
    await this.check();

    // Schedule periodic checks
    this.monitoringInterval = setInterval(async () => {
      await this.check();
    }, checkInterval) as unknown as NodeJS.Timeout;
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval as NodeJS.Timeout);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * Record a request
   */
  recordRequest(success: boolean, latency: number): void {
    const entry: RequestEntry = {
      timestamp: new Date(),
      success,
      latency,
    };

    this.requestHistory.push(entry);

    // Trim history if needed
    if (this.requestHistory.length > this.config.historySize) {
      this.requestHistory.shift();
    }

    // Update metrics
    this.updateMetrics(entry);
  }

  /**
   * Get current metrics
   */
  getMetrics(): HealthMetrics {
    return { ...this.metrics };
  }

  /**
   * Get request count
   */
  getRequestCount(): number {
    return this.metrics.totalRequests;
  }

  /**
   * Get average latency
   */
  getAverageLatency(): number {
    return this.metrics.averageLatency;
  }

  /**
   * Get error rate
   */
  getErrorRate(): number {
    return this.metrics.errorRate;
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    return (
      this.metrics.errorRate <= this.config.maxErrorRate &&
      this.metrics.averageLatency <= this.config.maxLatency
    );
  }

  /**
   * Get detailed health status with metrics
   */
  async getDetailedStatus(): Promise<HealthStatus & { metrics: HealthMetrics; healthy: boolean }> {
    const status = await this.check();
    const metrics = this.getMetrics();
    const healthy = this.isHealthy();

    return {
      ...status,
      metrics,
      healthy,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.requestHistory = [];
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): HealthMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      errorRate: 0,
      lastCheck: new Date(),
    };
  }

  /**
   * Update metrics based on new request
   */
  private updateMetrics(entry: RequestEntry): void {
    this.metrics.totalRequests++;
    this.metrics.lastCheck = entry.timestamp;

    if (entry.success) {
      this.metrics.successfulRequests++;
      this.metrics.lastSuccess = entry.timestamp;

      // Update latency stats
      if (entry.latency < this.metrics.minLatency) {
        this.metrics.minLatency = entry.latency;
      }
      if (entry.latency > this.metrics.maxLatency) {
        this.metrics.maxLatency = entry.latency;
      }

      // Calculate average latency (only successful requests)
      const totalLatency = this.metrics.averageLatency * (this.metrics.successfulRequests - 1) + entry.latency;
      this.metrics.averageLatency = totalLatency / this.metrics.successfulRequests;
    } else {
      this.metrics.failedRequests++;
      this.metrics.lastFailure = entry.timestamp;
    }

    // Update error rate
    this.metrics.errorRate = this.metrics.failedRequests / this.metrics.totalRequests;
  }

  /**
   * Get request history
   */
  getRequestHistory(): RequestEntry[] {
    return [...this.requestHistory];
  }

  /**
   * Get recent requests (last N)
   */
  getRecentRequests(count: number): RequestEntry[] {
    return this.requestHistory.slice(-count);
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.stopMonitoring();
    this.resetMetrics();
  }
}
