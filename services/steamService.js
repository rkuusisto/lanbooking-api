import config from '../config/config.js';

const STEAM_API_BASE_URL = 'https://api.steampowered.com';

// Steam64 ID format: 17-digit numeric string
const STEAM64_REGEX = /^[0-9]{17}$/;

// ============================================================================
// In-Memory Cache with TTL
// ============================================================================

/**
 * Simple in-memory cache for Steam user data with TTL.
 * Steam data rarely updates, so we cache for 24 hours.
 * Only successful responses are cached - errors are not cached.
 */
class SteamUserCache {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
    };
    // Cache TTL: 24 hours in milliseconds
    this.ttl = 24 * 60 * 60 * 1000;
  }

  /**
   * Get cached data if it exists and hasn't expired
   * @param {string} steamId - Steam ID
   * @returns {Object|null} - Cached data or null
   */
  get(steamId) {
    const cacheKey = steamId.trim();
    const cached = this.cache.get(cacheKey);

    if (cached) {
      const now = Date.now();
      // Check if cache entry has expired
      if (now - cached.timestamp < this.ttl) {
        this.stats.hits++;
        return cached.data;
      } else {
        // Entry expired, remove it
        this.cache.delete(cacheKey);
        this.stats.size = this.cache.size;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set cached data (only for successful responses)
   * @param {string} steamId - Steam ID
   * @param {Object} data - Data to cache
   */
  set(steamId, data) {
    const cacheKey = steamId.trim();
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
    this.stats.size = this.cache.size;
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0 };
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache stats
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? Math.round((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100)
        : 0,
    };
  }
}

const cache = new SteamUserCache();

// ============================================================================
// Semaphore Implementation
// ============================================================================

/**
 * Semaphore for managing concurrent access with Promise-based signaling
 * Replaces busy-wait polling with efficient Promise queuing
 */
class Semaphore {
  constructor(max) {
    this.max = max;
    this.count = 0;
    this.waiting = [];
  }

  /**
   * Acquire a permit from the semaphore
   * Returns immediately if permits available, otherwise waits
   * @returns {Promise<void>} - Resolves when permit is acquired
   */
  async acquire() {
    if (this.count < this.max) {
      this.count++;
      return;
    }
    // Wait for a permit to become available
    await new Promise(resolve => this.waiting.push(resolve));
  }

  /**
   * Release a permit back to the semaphore
   * Wakes up the next waiting request if any
   */
  release() {
    this.count--;
    if (this.waiting.length > 0) {
      this.count++;
      const resolve = this.waiting.shift();
      resolve();
    }
  }
}

// ============================================================================
// Request Pool/Throttling Manager
// ============================================================================

/**
 * Manages concurrent requests to Steam API with rate limiting
 * Pool size: 10 concurrent requests
 * Sleep after fetch: 500ms (whether successful or not)
 * Cached responses bypass throttling entirely
 * Uses semaphore pattern for efficient concurrency control (no busy-waiting)
 */
class SteamRequestPool {
  constructor(options = {}) {
    this.poolSize = options.poolSize || 10;
    this.sleepAfterFetch = options.sleepAfterFetch || 500;
    this.semaphore = new Semaphore(this.poolSize);
  }

  /**
   * Execute a request through the pool with throttling
   * @param {Function} requestFn - Async function that performs the actual request
   * @returns {Promise<any>} - Result of the request
   */
  async execute(requestFn) {
    // Acquire permit from semaphore (waits if pool is full)
    await this.semaphore.acquire();

    try {
      const result = await requestFn();
      
      // Sleep after fetch (whether successful or not)
      await new Promise(resolve => setTimeout(resolve, this.sleepAfterFetch));

      return result;
    } catch (error) {
      // Sleep after fetch even on error
      await new Promise(resolve => setTimeout(resolve, this.sleepAfterFetch));

      throw error;
    } finally {
      // Always release permit, allowing next waiting request to proceed
      this.semaphore.release();
    }
  }

  /**
   * Update pool configuration
   * NOTE: Changing poolSize at runtime is not thread-safe and may affect in-flight requests.
   * For production use, configure once at startup and avoid runtime changes.
   * @param {Object} options - Configuration options
   * @param {number} options.poolSize - Maximum concurrent requests
   * @param {number} options.sleepAfterFetch - Sleep duration in ms after each fetch
   */
  configure(options) {
    if (options.poolSize !== undefined && options.poolSize !== this.poolSize) {
      // Recreate semaphore with new size
      // Note: This does not affect in-flight requests, but new requests will use new limit
      this.poolSize = options.poolSize;
      this.semaphore = new Semaphore(options.poolSize);
    }
    if (options.sleepAfterFetch !== undefined) {
      this.sleepAfterFetch = options.sleepAfterFetch;
    }
  }
}

const requestPool = new SteamRequestPool({
  poolSize: 10,
  sleepAfterFetch: 500,
});

// ============================================================================
// Steam API Service
// ============================================================================

/**
 * Fetches Steam user information by Steam ID
 * Uses caching to minimize calls to the Steam API.
 * Only successful responses are cached - errors are not cached.
 * Rate limiting: Pool size 10, 500ms sleep after each fetch.
 * Cached responses bypass throttling entirely.
 * 
 * NOTE: Per-request throttling options have been removed to maintain thread-safety.
 * Use configureRequestPool() at startup to adjust global rate limiting if needed.
 * 
 * @param {string} steamId - The Steam ID to look up
 * @returns {Promise<{steamId: string, personaName: string, avatarUrl: string}>}
 * @throws {Error} If steamId is invalid, API key is missing, or user not found
 */
export async function getUserBySteamId(steamId) {
  if (!steamId || typeof steamId !== 'string' || steamId.trim() === '') {
    throw new Error('Steam ID is required');
  }

  const trimmedSteamId = steamId.trim();
  
  // Validate Steam64 ID format (17-digit numeric string) before making API call
  if (!STEAM64_REGEX.test(trimmedSteamId)) {
    throw new Error('Invalid Steam ID format. Expected 17-digit numeric Steam64 ID.');
  }

  // Check cache first - cached responses bypass throttling entirely
  const cached = cache.get(trimmedSteamId);
  if (cached) {
    return cached;
  }

  const apiKey = config.STEAM_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    throw new Error('Steam API key is not configured');
  }

  // Use shared request pool with semaphore-based rate limiting
  return await requestPool.execute(async () => {
    try {
      const url = new URL('/ISteamUser/GetPlayerSummaries/v0002/', STEAM_API_BASE_URL);
      url.searchParams.append('key', apiKey);
      url.searchParams.append('steamids', trimmedSteamId);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Steam API returned status ${response.status}`);
      }

      const responseJson = await response.json();

      if (!responseJson || !responseJson.response) {
        throw new Error('Steam user not found');
      }

      const players = responseJson.response.players;

      if (!Array.isArray(players) || players.length === 0) {
        throw new Error('Steam user not found');
      }

      const player = players[0];
      const personaName = player.personaname || '';
      const avatarFull = player.avatarfull || '';

      const userData = {
        steamId: trimmedSteamId,
        personaName,
        avatarUrl: avatarFull,
      };

      // Only cache successful responses - errors are not cached
      cache.set(trimmedSteamId, userData);

      return userData;
    } catch (error) {
      // Do not cache errors - let them pass through
      // Pass through validation errors and known errors without wrapping
      if (error.message === 'Steam ID is required' || 
          error.message.includes('Invalid Steam ID format') ||
          error.message === 'Steam API key is not configured' || 
          error.message === 'Steam user not found') {
        throw error;
      }
      throw new Error(`Failed to fetch Steam user details: ${error.message}`, { cause: error });
    }
  });
}

/**
 * Clear Steam user cache
 */
export function clearCache() {
  cache.clear();
}

/**
 * Get cache statistics
 * @returns {Object} - Cache stats
 */
export function getCacheStats() {
  return cache.getStats();
}

/**
 * Configure the request pool (allows overrides)
 * @param {Object} options - Configuration options
 * @param {number} options.poolSize - Maximum concurrent requests (default: 10)
 * @param {number} options.sleepAfterFetch - Sleep duration in ms after each fetch (default: 500)
 */
export function configureRequestPool(options) {
  requestPool.configure(options);
}

export default {
  getUserBySteamId,
  clearCache,
  getCacheStats,
  configureRequestPool,
};

