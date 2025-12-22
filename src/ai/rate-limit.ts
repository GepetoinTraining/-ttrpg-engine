// ============================================
// RATE LIMITING
// ============================================
//
// Rate limiting for Gemini API calls.
//
// Gemini API limits:
//   - Free tier: 15 RPM (requests per minute)
//   - Paid tier: 360 RPM
//   - Per-model limits may vary
//

// ============================================
// TYPES
// ============================================

export interface RateLimiterConfig {
  requestsPerMinute: number;
  requestsPerDay?: number;
  burstLimit?: number;
  queueTimeout?: number; // ms
}

export interface RateLimiterStats {
  requestsThisMinute: number;
  requestsToday: number;
  queueLength: number;
  lastRequestTime: number;
  isLimited: boolean;
}

interface QueuedRequest {
  resolve: () => void;
  reject: (error: Error) => void;
  timestamp: number;
}

// ============================================
// RATE LIMITER CLASS
// ============================================

export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private minuteWindow: number[] = [];
  private dayWindow: number[] = [];
  private queue: QueuedRequest[] = [];
  private processing = false;

  constructor(config: RateLimiterConfig) {
    this.config = {
      requestsPerDay: Infinity,
      burstLimit: 5,
      queueTimeout: 60000,
      ...config,
    };
  }

  // ==========================================
  // MAIN API
  // ==========================================

  /**
   * Acquire permission to make a request.
   * Blocks if rate limited, queues if necessary.
   */
  async acquire(): Promise<void> {
    const now = Date.now();

    // Clean old entries
    this.cleanWindows(now);

    // Check if we can proceed immediately
    if (this.canProceed()) {
      this.recordRequest(now);
      return;
    }

    // Queue the request
    return this.enqueue(now);
  }

  /**
   * Try to acquire without waiting.
   * Returns false if rate limited.
   */
  tryAcquire(): boolean {
    const now = Date.now();
    this.cleanWindows(now);

    if (this.canProceed()) {
      this.recordRequest(now);
      return true;
    }

    return false;
  }

  /**
   * Get current stats
   */
  getStats(): RateLimiterStats {
    const now = Date.now();
    this.cleanWindows(now);

    return {
      requestsThisMinute: this.minuteWindow.length,
      requestsToday: this.dayWindow.length,
      queueLength: this.queue.length,
      lastRequestTime: this.minuteWindow[this.minuteWindow.length - 1] || 0,
      isLimited: !this.canProceed(),
    };
  }

  /**
   * Get time until next request is allowed
   */
  getWaitTime(): number {
    if (this.canProceed()) return 0;

    const now = Date.now();
    const oldestInMinute = this.minuteWindow[0];

    if (oldestInMinute) {
      return Math.max(0, oldestInMinute + 60000 - now);
    }

    return 0;
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.minuteWindow = [];
    this.dayWindow = [];

    // Reject all queued requests
    for (const request of this.queue) {
      request.reject(new Error("Rate limiter reset"));
    }
    this.queue = [];
  }

  // ==========================================
  // INTERNAL
  // ==========================================

  private canProceed(): boolean {
    // Check minute limit
    if (this.minuteWindow.length >= this.config.requestsPerMinute) {
      return false;
    }

    // Check day limit
    if (this.dayWindow.length >= this.config.requestsPerDay) {
      return false;
    }

    // Check burst limit (requests in last second)
    const now = Date.now();
    const recentRequests = this.minuteWindow.filter((t) => t > now - 1000);
    if (recentRequests.length >= this.config.burstLimit) {
      return false;
    }

    return true;
  }

  private recordRequest(timestamp: number): void {
    this.minuteWindow.push(timestamp);
    this.dayWindow.push(timestamp);
  }

  private cleanWindows(now: number): void {
    // Remove entries older than 1 minute
    const minuteAgo = now - 60000;
    this.minuteWindow = this.minuteWindow.filter((t) => t > minuteAgo);

    // Remove entries older than 24 hours
    const dayAgo = now - 86400000;
    this.dayWindow = this.dayWindow.filter((t) => t > dayAgo);
  }

  private async enqueue(timestamp: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        resolve,
        reject,
        timestamp,
      };

      this.queue.push(request);
      this.processQueue();

      // Set timeout
      setTimeout(() => {
        const index = this.queue.indexOf(request);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(new Error("Rate limit queue timeout"));
        }
      }, this.config.queueTimeout);
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      this.cleanWindows(now);

      if (this.canProceed()) {
        const request = this.queue.shift()!;
        this.recordRequest(now);
        request.resolve();
      } else {
        // Wait until we can proceed
        const waitTime = this.getWaitTime();
        await this.delay(Math.max(waitTime, 100));
      }
    }

    this.processing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// TOKEN BUCKET (ALTERNATIVE)
// ============================================

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private config: {
    capacity: number;
    refillRate: number; // tokens per second
  };

  constructor(capacity: number, refillRate: number) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.config = { capacity, refillRate };
  }

  async acquire(tokens = 1): Promise<boolean> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    // Wait for tokens
    const needed = tokens - this.tokens;
    const waitTime = (needed / this.config.refillRate) * 1000;

    await this.delay(waitTime);
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  tryAcquire(tokens = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.config.refillRate;

    this.tokens = Math.min(this.config.capacity, this.tokens + newTokens);
    this.lastRefill = now;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// PER-USER RATE LIMITING
// ============================================

export class UserRateLimiter {
  private limiters: Map<string, RateLimiter> = new Map();
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  async acquire(userId: string): Promise<void> {
    const limiter = this.getOrCreate(userId);
    return limiter.acquire();
  }

  tryAcquire(userId: string): boolean {
    const limiter = this.getOrCreate(userId);
    return limiter.tryAcquire();
  }

  getStats(userId: string): RateLimiterStats {
    const limiter = this.limiters.get(userId);
    if (!limiter) {
      return {
        requestsThisMinute: 0,
        requestsToday: 0,
        queueLength: 0,
        lastRequestTime: 0,
        isLimited: false,
      };
    }
    return limiter.getStats();
  }

  reset(userId: string): void {
    const limiter = this.limiters.get(userId);
    if (limiter) {
      limiter.reset();
    }
  }

  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
    this.limiters.clear();
  }

  private getOrCreate(userId: string): RateLimiter {
    let limiter = this.limiters.get(userId);

    if (!limiter) {
      limiter = new RateLimiter(this.config);
      this.limiters.set(userId, limiter);
    }

    return limiter;
  }

  // Cleanup old limiters periodically
  cleanup(maxIdleMs = 3600000): void {
    const now = Date.now();

    for (const [userId, limiter] of this.limiters) {
      const stats = limiter.getStats();
      if (stats.lastRequestTime && now - stats.lastRequestTime > maxIdleMs) {
        this.limiters.delete(userId);
      }
    }
  }
}

// ============================================
// GLOBAL RATE LIMITER
// ============================================

export class GlobalRateLimiter {
  private globalLimiter: RateLimiter;
  private userLimiter: UserRateLimiter;

  constructor(globalConfig: RateLimiterConfig, userConfig: RateLimiterConfig) {
    this.globalLimiter = new RateLimiter(globalConfig);
    this.userLimiter = new UserRateLimiter(userConfig);
  }

  async acquire(userId: string): Promise<void> {
    // Check user limit first (faster rejection)
    await this.userLimiter.acquire(userId);

    // Then check global limit
    await this.globalLimiter.acquire();
  }

  tryAcquire(userId: string): boolean {
    if (!this.userLimiter.tryAcquire(userId)) {
      return false;
    }

    if (!this.globalLimiter.tryAcquire()) {
      return false;
    }

    return true;
  }

  getStats(userId?: string): {
    global: RateLimiterStats;
    user?: RateLimiterStats;
  } {
    return {
      global: this.globalLimiter.getStats(),
      user: userId ? this.userLimiter.getStats(userId) : undefined,
    };
  }
}

// ============================================
// SINGLETON
// ============================================

let rateLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    // Default: 15 RPM (Gemini free tier)
    rateLimiter = new RateLimiter({
      requestsPerMinute: 15,
      burstLimit: 3,
    });
  }
  return rateLimiter;
}

export function initRateLimiter(config: RateLimiterConfig): RateLimiter {
  rateLimiter = new RateLimiter(config);
  return rateLimiter;
}
