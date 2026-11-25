/** Token bucket that spaces outbound provider requests to stay inside a per-minute quota. */
export class RateLimiter {
  private tokens: number;
  private last = Date.now();

  constructor(private perMinute: number) {
    this.tokens = perMinute;
  }

  /** Takes a token if one is free without waiting. */
  tryTake(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  async take(): Promise<void> {
    while (!this.tryTake()) {
      const waitMs = Math.ceil(((1 - this.tokens) / this.perMinute) * 60_000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private refill() {
    const now = Date.now();
    this.tokens = Math.min(this.perMinute, this.tokens + ((now - this.last) / 60_000) * this.perMinute);
    this.last = now;
  }
}
