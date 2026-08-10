import { RateLimiterMemory } from "rate-limiter-flexible";

// Max 3 attempts per 10 minutes, per IP+endpoint combo
const rateLimiter = new RateLimiterMemory({
  points: 3,          // number of allowed attempts
  duration: 600,       // per 600 seconds (10 minutes)
});

export async function checkRateLimit(key: string): Promise<boolean> {
  try {
    await rateLimiter.consume(key);
    return true; // allowed
  } catch {
    return false; // rate limited
  }
}