// =============================================================================
// RATE LIMITING
// =============================================================================
//
// Rate limiting for AI API calls.
// Supports per-user, per-campaign, and global limits.
//
// Usage:
//   enforceRateLimit(userId, campaignId, "npcChat");
//   // Throws RateLimitError if exceeded
//

// =============================================================================
// TYPES
// =============================================================================

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimiterStats {
  requestsThisWindow: number;
  remaining: number;
  resetIn: number;
  isLimited: boolean;
}

// =============================================================================
// DEFAULT LIMITS
// =============================================================================

export const RATE_LIMITS = {
  // Per-user limits
  user: {
    npcChat: { maxRequests: 30, windowMs: 60_000 }, // 30/min
    generate: { maxRequests: 10, windowMs: 60_000 }, // 10/min
    deepGen: { maxRequests: 5, windowMs: 60_000 }, // 5/min (expensive)
  },
  // Per-campaign limits (shared across all users)
  campaign: {
    total: { maxRequests: 100, windowMs: 60_000 }, // 100/min total
  },
  // Global limits (Gemini API limits)
  global: {
    requestsPerMinute: 60, // Adjust based on your tier
    burstLimit: 10,
  },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS.user;

// =============================================================================
// IN-MEMORY STORE
// =============================================================================

// In-memory store (use Redis in production for distributed systems)
const rateLimits = new Map<string, RateLimitEntry>();

// =============================================================================
// CORE RATE LIMIT FUNCTIONS
// =============================================================================

/**
 * Check if request is rate limited
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimits.get(key);

  // No existing entry or window expired
  if (!entry || now >= entry.resetAt) {
    rateLimits.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }

  // Within window - check limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetAt - now,
    };
  }

  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetAt - now,
  };
}

/**
 * Build rate limit key
 */
export function rateLimitKey(
  type: "user" | "campaign",
  id: string,
  action: string
): string {
  return `ratelimit:${type}:${id}:${action}`;
}

/**
 * Check user rate limit for an action
 */
export function checkUserRateLimit(
  userId: string,
  action: RateLimitType
): { allowed: boolean; remaining: number; resetIn: number } {
  const key = rateLimitKey("user", userId, action);
  const config = RATE_LIMITS.user[action];
  return checkRateLimit(key, config);
}

/**
 * Check campaign-wide rate limit
 */
export function checkCampaignRateLimit(
  campaignId: string
): { allowed: boolean; remaining: number; resetIn: number } {
  const key = rateLimitKey("campaign", campaignId, "total");
  const config = RATE_LIMITS.campaign.total;
  return checkRateLimit(key, config);
}

/**
 * Enforce rate limit - throws if exceeded
 */
export function enforceRateLimit(
  userId: string,
  campaignId: string,
  action: RateLimitType
): void {
  // Check user limit
  const userCheck = checkUserRateLimit(userId, action);
  if (!userCheck.allowed) {
    throw new RateLimitError(
      `Rate limit exceeded for ${action}. Try again in ${Math.ceil(userCheck.resetIn / 1000)}s`,
      userCheck.resetIn
    );
  }

  // Check campaign limit
  const campaignCheck = checkCampaignRateLimit(campaignId);
  if (!campaignCheck.allowed) {
    throw new RateLimitError(
      `Campaign rate limit exceeded. Try again in ${Math.ceil(campaignCheck.resetIn / 1000)}s`,
      campaignCheck.resetIn
    );
  }
}

/**
 * Get stats for a rate limit key
 */
export function getRateLimitStats(key: string, config: RateLimitConfig): RateLimiterStats {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now >= entry.resetAt) {
    return {
      requestsThisWindow: 0,
      remaining: config.maxRequests,
      resetIn: 0,
      isLimited: false,
    };
  }

  return {
    requestsThisWindow: entry.count,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetIn: entry.resetAt - now,
    isLimited: entry.count >= config.maxRequests,
  };
}

// =============================================================================
// RATE LIMIT ERROR
// =============================================================================

export class RateLimitError extends Error {
  public retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

// =============================================================================
// TOKEN BUCKET (Alternative algorithm)
// =============================================================================

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

// =============================================================================
// WINDOW-BASED RATE LIMITER CLASS
// =============================================================================

export class RateLimiter {
  private config: Required<RateLimitConfig & { burstLimit: number; queueTimeout: number }>;
  private minuteWindow: number[] = [];
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private processing = false;

  constructor(config: RateLimitConfig & { burstLimit?: number; queueTimeout?: number }) {
    this.config = {
      burstLimit: config.burstLimit ?? 5,
      queueTimeout: config.queueTimeout ?? 60000,
      ...config,
    };
  }

  /**
   * Acquire permission to make a request
   */
  async acquire(): Promise<void> {
    const now = Date.now();
    this.cleanWindow(now);

    if (this.canProceed(now)) {
      this.recordRequest(now);
      return;
    }

    return this.enqueue(now);
  }

  /**
   * Try to acquire without waiting
   */
  tryAcquire(): boolean {
    const now = Date.now();
    this.cleanWindow(now);

    if (this.canProceed(now)) {
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
    this.cleanWindow(now);

    const count = this.minuteWindow.length;
    return {
      requestsThisWindow: count,
      remaining: Math.max(0, this.config.maxRequests - count),
      resetIn: this.getWaitTime(),
      isLimited: !this.canProceed(now),
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.minuteWindow = [];
    for (const request of this.queue) {
      request.reject(new Error("Rate limiter reset"));
    }
    this.queue = [];
  }

  private canProceed(now: number): boolean {
    if (this.minuteWindow.length >= this.config.maxRequests) {
      return false;
    }

    // Check burst limit
    const recentRequests = this.minuteWindow.filter((t) => t > now - 1000);
    if (recentRequests.length >= this.config.burstLimit) {
      return false;
    }

    return true;
  }

  private recordRequest(timestamp: number): void {
    this.minuteWindow.push(timestamp);
  }

  private cleanWindow(now: number): void {
    const windowStart = now - this.config.windowMs;
    this.minuteWindow = this.minuteWindow.filter((t) => t > windowStart);
  }

  private getWaitTime(): number {
    if (this.minuteWindow.length === 0) return 0;

    const now = Date.now();
    const oldest = this.minuteWindow[0];
    return Math.max(0, oldest + this.config.windowMs - now);
  }

  private async enqueue(timestamp: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = { resolve, reject, timestamp };
      this.queue.push(request);
      this.processQueue();

      setTimeout(() => {
        const index = this.queue.indexOf(request);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(new RateLimitError("Rate limit queue timeout", this.config.queueTimeout));
        }
      }, this.config.queueTimeout);
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      this.cleanWindow(now);

      if (this.canProceed(now)) {
        const request = this.queue.shift()!;
        this.recordRequest(now);
        request.resolve();
      } else {
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

// =============================================================================
// PER-USER RATE LIMITER
// =============================================================================

export class UserRateLimiter {
  private limiters: Map<string, RateLimiter> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
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
        requestsThisWindow: 0,
        remaining: this.config.maxRequests,
        resetIn: 0,
        isLimited: false,
      };
    }
    return limiter.getStats();
  }

  reset(userId: string): void {
    const limiter = this.limiters.get(userId);
    limiter?.reset();
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

  cleanup(maxIdleMs = 3600000): void {
    const now = Date.now();

    for (const [userId, limiter] of this.limiters) {
      const stats = limiter.getStats();
      if (stats.requestsThisWindow === 0) {
        this.limiters.delete(userId);
      }
    }
  }
}

// =============================================================================
// GLOBAL RATE LIMITER
// =============================================================================

export class GlobalRateLimiter {
  private globalLimiter: RateLimiter;
  private userLimiter: UserRateLimiter;

  constructor(globalConfig: RateLimitConfig, userConfig: RateLimitConfig) {
    this.globalLimiter = new RateLimiter(globalConfig);
    this.userLimiter = new UserRateLimiter(userConfig);
  }

  async acquire(userId: string): Promise<void> {
    await this.userLimiter.acquire(userId);
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

// =============================================================================
// SINGLETON
// =============================================================================

let defaultRateLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!defaultRateLimiter) {
    defaultRateLimiter = new RateLimiter({
      maxRequests: RATE_LIMITS.global.requestsPerMinute,
      windowMs: 60_000,
      burstLimit: RATE_LIMITS.global.burstLimit,
    });
  }
  return defaultRateLimiter;
}

export function initRateLimiter(config: RateLimitConfig): RateLimiter {
  defaultRateLimiter = new RateLimiter(config);
  return defaultRateLimiter;
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpiredLimits(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimits.entries()) {
    if (now >= entry.resetAt) {
      rateLimits.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Cleanup every 5 minutes
setInterval(() => {
  const cleaned = cleanupExpiredLimits();
  if (cleaned > 0) {
    console.log(`[RateLimit] Cleaned ${cleaned} expired entries`);
  }
}, 5 * 60 * 1000);
