/**
 * Phone Number Utility
 * Normalizes phone numbers to international format
 * @module utils/phoneUtils
 */

/**
 * Normalizes a phone number to international format with +358 country code (or existing country code)
 * Handles formats:
 * - 045 346 2128 (replace 0 with +358) -> +358453462128
 * - +358 45 346 2128 (keep as is) -> +358453462128
 * - 45 346 2128 (pad with +358) -> +358453462128
 * 
 * @param {string|null|undefined} phone - Phone number to normalize (can be null/undefined)
 * @returns {string|null} Normalized phone number with all spaces stripped, or null if input was empty
 */
export function normalizePhone(phone) {
  if (!phone) return null; // Optional field
  
  // Strip all spaces
  let normalized = phone.replace(/\s+/g, '');
  
  // Handle format: 045 346 2128 -> replace leading 0 with +358
  if (normalized.startsWith('0')) {
    normalized = '+358' + normalized.substring(1);
  }
  // Handle format: +358 45 346 2128 -> already has country code with +, keep as is
  else if (normalized.startsWith('+')) {
    // Already has country code, keep as is (just stripped of spaces)
    // Allow format: ^+\d{1,3} (country code can be 1-3 digits after +)
  }
  // Handle format: 45 346 2128 -> pad with +358 (no leading 0, no + prefix)
  else {
    normalized = '+358' + normalized;
  }
  
  return normalized;
}

export default normalizePhone;



