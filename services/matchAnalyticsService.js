/**
 * Match Analytics Service
 * 
 * Main entry point for match analytics with caching layer.
 * Since match data is historical and immutable, we cache aggressively.
 */

import collective from './analytics/collective.js';
import repository from './analytics/repository.js';

// ============================================================================
// In-Memory Cache
// ============================================================================

/**
 * Simple in-memory cache for match analytics with LRU eviction.
 * Since match data is immutable historical data, we can cache indefinitely.
 * Cache is cleared on server restart.
 * Implements LRU eviction when maxSize is exceeded.
 */
class AnalyticsCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
    };
  }

  /**
   * Generate cache key
   * @param {string} matchId - Match ID
   * @param {string} dataType - Type of data (e.g., 'analytics', 'mvps', 'highlights')
   * @returns {string} - Cache key
   */
  key(matchId, dataType) {
    return `${matchId}:${dataType}`;
  }

  /**
   * Get cached data
   * Updates LRU order by re-inserting accessed entry
   * @param {string} matchId - Match ID
   * @param {string} dataType - Type of data
   * @returns {Object|null} - Cached data or null
   */
  get(matchId, dataType) {
    const cacheKey = this.key(matchId, dataType);
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      // Update LRU order: delete and re-insert to move to end (most recently used)
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      this.stats.hits++;
      return cached;
    }
    
    this.stats.misses++;
    return null;
  }

  /**
   * Set cached data
   * Implements LRU eviction: if cache exceeds maxSize, removes oldest entry
   * @param {string} matchId - Match ID
   * @param {string} dataType - Type of data
   * @param {Object} data - Data to cache
   */
  set(matchId, dataType, data) {
    const cacheKey = this.key(matchId, dataType);
    
    // If key already exists, delete it first to update insertion order
    if (this.cache.has(cacheKey)) {
      this.cache.delete(cacheKey);
    }
    
    // If cache is full, evict oldest entry (first in Map iteration order)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(cacheKey, data);
    this.stats.size = this.cache.size;
  }

  /**
   * Invalidate cache for a match
   * @param {string} matchId - Match ID
   */
  invalidate(matchId) {
    const keysToDelete = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(`${matchId}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
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

const cache = new AnalyticsCache();

// ============================================================================
// Cache-Wrapped Analytics Functions
// ============================================================================

/**
 * Create a cached version of an analytics function
 * @param {string} dataType - Cache data type key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @returns {Function} - Cached function
 */
function withCache(dataType, fetchFn) {
  return async (matchId, ...args) => {
    // Check if match exists first (prevents caching null for non-existent matches)
    const exists = await repository.matchExists(matchId);
    if (!exists) {
      return null;
    }

    // Check cache
    const cached = cache.get(matchId, dataType);
    if (cached) {
      return cached;
    }

    // Fetch and cache
    const data = await fetchFn(matchId, ...args);
    if (data) {
      cache.set(matchId, dataType, data);
    }
    
    return data;
  };
}

// ============================================================================
// Public API - Cached Analytics Functions
// ============================================================================

/**
 * Get complete match analytics (cached)
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Match analytics
 */
export const getMatchAnalytics = withCache('analytics', collective.getMatchAnalytics);

/**
 * Get match MVPs (cached)
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - MVP data
 */
export const getMatchMVPs = withCache('mvps', collective.getMatchMVPs);

/**
 * Get round-by-round MVP breakdown (cached)
 * @param {string} matchId - Match ID
 * @returns {Promise<Array>} - Round MVPs
 */
export const getRoundMVPs = withCache('round-mvps', collective.getRoundMVPs);

/**
 * Get match highlights (cached)
 * @param {string} matchId - Match ID
 * @param {number} limit - Maximum highlights
 * @returns {Promise<Object>} - Highlights
 */
export const getMatchHighlights = withCache('highlights', collective.getMatchHighlights);

/**
 * Get player progressions (cached)
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Progression data
 */
export const getPlayerProgressions = withCache('progressions', collective.getPlayerProgressions);

/**
 * Get team analytics (cached)
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Team analytics
 */
export const getTeamAnalytics = withCache('team-analytics', collective.getTeamAnalytics);

/**
 * Get weapon statistics (cached)
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Weapon stats
 */
export const getWeaponStats = withCache('weapon-stats', collective.getWeaponStats);

/**
 * Get opening duel statistics (cached)
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Opening duel stats
 */
export const getOpeningDuelStats = withCache('opening-duels', collective.getOpeningDuelStats);

/**
 * Get trade kill analysis (cached)
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Trade analysis
 */
export const getTradeAnalysis = withCache('trade-analysis', collective.getTradeAnalysis);

/**
 * Get progression report for a specific player (not cached - too granular)
 * @param {string} matchId - Match ID
 * @param {string} steamId - Player's Steam ID
 * @returns {Promise<Object>} - Player progression
 */
export async function getPlayerProgressionReport(matchId, steamId) {
  const exists = await repository.matchExists(matchId);
  if (!exists) {
    return null;
  }
  return collective.getPlayerProgressionReport(matchId, steamId);
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Invalidate cache for a specific match
 * @param {string} matchId - Match ID
 */
export function invalidateMatchCache(matchId) {
  cache.invalidate(matchId);
}

/**
 * Clear entire analytics cache
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

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Main analytics
  getMatchAnalytics,
  getMatchMVPs,
  getRoundMVPs,
  getMatchHighlights,
  getPlayerProgressions,
  getPlayerProgressionReport,
  getTeamAnalytics,
  getWeaponStats,
  getOpeningDuelStats,
  getTradeAnalysis,
  
  // Cache management
  invalidateMatchCache,
  clearCache,
  getCacheStats,
};




