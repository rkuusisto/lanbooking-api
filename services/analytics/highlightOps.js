/**
 * Match Highlight Detection Operative Functions
 * 
 * Functions for detecting and categorizing notable moments in a match.
 */

// ============================================================================
// Multi-kill Detection
// ============================================================================

/**
 * Detect multi-kills within a round (kills happening within short time window)
 * @param {Array} events - Round events
 * @param {string} attackerSteamId - Steam ID of the attacker
 * @param {number} tickWindow - Maximum ticks between kills to count as multi-kill (default ~2 seconds)
 * @returns {Array} - Array of multi-kill events
 */
export function detectMultiKills(events, attackerSteamId, tickWindow = 256) {
  const kills = events
    .filter(e => e.eventType === 'kill' && e.attackerSteamId === attackerSteamId)
    .sort((a, b) => a.tick - b.tick);
  
  if (kills.length < 2) return [];
  
  const multiKills = [];
  let currentStreak = [kills[0]];
  
  for (let i = 1; i < kills.length; i++) {
    const timeDiff = kills[i].tick - kills[i - 1].tick;
    
    if (timeDiff <= tickWindow) {
      currentStreak.push(kills[i]);
    } else {
      if (currentStreak.length >= 2) {
        multiKills.push({
          count: currentStreak.length,
          kills: currentStreak,
          startTick: currentStreak[0].tick,
          endTick: currentStreak[currentStreak.length - 1].tick,
        });
      }
      currentStreak = [kills[i]];
    }
  }
  
  // Don't forget the last streak
  if (currentStreak.length >= 2) {
    multiKills.push({
      count: currentStreak.length,
      kills: currentStreak,
      startTick: currentStreak[0].tick,
      endTick: currentStreak[currentStreak.length - 1].tick,
    });
  }
  
  return multiKills;
}

/**
 * Detect aces (5 kills by one player in a round)
 * @param {Array} events - Round events
 * @param {Array} players - All players
 * @returns {Array} - Array of ace highlights
 */
export function detectAces(events, players) {
  const aces = [];
  const killsByPlayer = {};
  
  events
    .filter(e => e.eventType === 'kill')
    .forEach(kill => {
      if (!killsByPlayer[kill.attackerSteamId]) {
        killsByPlayer[kill.attackerSteamId] = [];
      }
      killsByPlayer[kill.attackerSteamId].push(kill);
    });
  
  Object.entries(killsByPlayer).forEach(([steamId, kills]) => {
    if (kills.length >= 5) {
      const player = players.find(p => p.steamId === steamId);
      aces.push({
        type: 'ace',
        steamId,
        playerName: player?.playerName || 'Unknown',
        team: player?.team,
        kills: kills.length,
        weapons: [...new Set(kills.map(k => k.weapon))],
        headshots: kills.filter(k => k.isHeadshot).length,
        roundNumber: kills[0].roundNumber,
      });
    }
  });
  
  return aces;
}

/**
 * Categorize multi-kill type
 * @param {number} count - Number of kills
 * @returns {string} - Kill type name
 */
export function getMultiKillType(count) {
  const types = {
    2: 'double_kill',
    3: 'triple_kill',
    4: 'quad_kill',
    5: 'ace',
  };
  return types[count] || (count > 5 ? 'ace_plus' : 'kill');
}

// ============================================================================
// Clutch Detection
// ============================================================================

/**
 * Detect clutch situations (1vX wins)
 * @param {Array} events - Round events
 * @param {Object} round - Round data
 * @param {Array} players - All players
 * @returns {Object|null} - Clutch highlight if found
 */
export function detectClutch(events, round, players) {
  const killEvents = events.filter(e => e.eventType === 'kill');
  if (killEvents.length === 0) return null;
  
  // Track player deaths to find 1vX situations
  const deaths = { CT: [], T: [] };
  const kills = {};
  
  killEvents.forEach(event => {
    const victim = players.find(p => p.steamId === event.victimSteamId);
    const attacker = players.find(p => p.steamId === event.attackerSteamId);
    
    if (victim) {
      deaths[victim.team].push({ tick: event.tick, steamId: victim.steamId });
    }
    
    if (attacker) {
      if (!kills[attacker.steamId]) kills[attacker.steamId] = [];
      kills[attacker.steamId].push(event);
    }
  });
  
  // Check for clutch scenario
  const winningTeam = round.winner;
  const losingTeam = winningTeam === 'CT' ? 'T' : 'CT';
  
  // A clutch is when the winning team had 4 deaths before the round ended
  // (1 player remaining) and still won
  const winningTeamDeaths = deaths[winningTeam].length;
  const winningTeamPlayers = players.filter(p => p.team === winningTeam).length;
  
  if (winningTeamDeaths >= winningTeamPlayers - 1 && winningTeamDeaths > 0) {
    // Find the last survivor (clutcher)
    const deadSteamIds = new Set(deaths[winningTeam].map(d => d.steamId));
    const clutcher = players.find(p => 
      p.team === winningTeam && !deadSteamIds.has(p.steamId)
    );
    
    if (clutcher) {
      // Count enemies alive when clutch started
      const clutcherKills = kills[clutcher.steamId] || [];
      const enemiesKilledInClutch = clutcherKills.length;
      
      // Only count as clutch if they killed at least 1 enemy
      if (enemiesKilledInClutch >= 1) {
        return {
          type: 'clutch',
          steamId: clutcher.steamId,
          playerName: clutcher.playerName,
          team: clutcher.team,
          situation: `1v${enemiesKilledInClutch}`,
          killsInClutch: enemiesKilledInClutch,
          roundNumber: round.roundNumber,
          winReason: round.winReason,
        };
      }
    }
  }
  
  return null;
}

// ============================================================================
// Notable Events Detection
// ============================================================================

/**
 * Detect opening picks (first kill of the round)
 * @param {Array} events - Round events
 * @param {Array} players - All players
 * @returns {Object|null} - Opening pick highlight
 */
export function detectOpeningPick(events, players) {
  const firstKill = events
    .filter(e => e.eventType === 'kill')
    .sort((a, b) => a.tick - b.tick)[0];
  
  if (!firstKill) return null;
  
  const attacker = players.find(p => p.steamId === firstKill.attackerSteamId);
  const victim = players.find(p => p.steamId === firstKill.victimSteamId);
  
  return {
    type: 'opening_pick',
    attackerSteamId: firstKill.attackerSteamId,
    attackerName: attacker?.playerName || 'Unknown',
    attackerTeam: attacker?.team,
    victimSteamId: firstKill.victimSteamId,
    victimName: victim?.playerName || 'Unknown',
    victimTeam: victim?.team,
    weapon: firstKill.weapon,
    isHeadshot: firstKill.isHeadshot,
    roundNumber: firstKill.roundNumber,
    tick: firstKill.tick,
  };
}

/**
 * Detect ninja defuse (CT wins by defuse with T players alive)
 * @param {Object} round - Round data
 * @param {Array} events - Round events
 * @param {Array} players - All players
 * @returns {Object|null} - Ninja defuse highlight
 */
export function detectNinjaDefuse(round, events, players) {
  if (round.winner !== 'CT' || round.winReason !== 'defuse') {
    return null;
  }
  
  const killEvents = events.filter(e => e.eventType === 'kill');
  const tDeaths = killEvents.filter(e => {
    const victim = players.find(p => p.steamId === e.victimSteamId);
    return victim?.team === 'T';
  });
  
  const tPlayers = players.filter(p => p.team === 'T');
  const tAlive = tPlayers.length - tDeaths.length;
  
  // Ninja defuse if 2+ T players were alive when bomb was defused
  if (tAlive >= 2) {
    const defuseEvent = events.find(e => e.eventType === 'defuse');
    const defuser = defuseEvent 
      ? players.find(p => p.steamId === defuseEvent.attackerSteamId)
      : null;
    
    return {
      type: 'ninja_defuse',
      steamId: defuser?.steamId,
      playerName: defuser?.playerName || 'Unknown',
      roundNumber: round.roundNumber,
      terroristsAlive: tAlive,
    };
  }
  
  return null;
}

/**
 * Detect wallbang kills
 * @param {Array} events - Events to analyze
 * @param {Array} players - All players
 * @returns {Array} - Wallbang highlights
 */
export function detectWallbangs(events, players) {
  // Wallbangs typically have eventData containing penetration info
  return events
    .filter(e => e.eventType === 'kill' && e.eventData?.penetrated)
    .map(event => {
      const attacker = players.find(p => p.steamId === event.attackerSteamId);
      const victim = players.find(p => p.steamId === event.victimSteamId);
      
      return {
        type: 'wallbang',
        attackerSteamId: event.attackerSteamId,
        attackerName: attacker?.playerName || 'Unknown',
        victimSteamId: event.victimSteamId,
        victimName: victim?.playerName || 'Unknown',
        weapon: event.weapon,
        roundNumber: event.roundNumber,
      };
    });
}

// ============================================================================
// Highlight Aggregation
// ============================================================================

/**
 * Analyze a round for all notable highlights
 * @param {Object} round - Round data
 * @param {Array} events - Round events
 * @param {Array} players - All players
 * @returns {Object} - All highlights in the round
 */
export function analyzeRoundHighlights(round, events, players) {
  const highlights = {
    roundNumber: round.roundNumber,
    winner: round.winner,
    winReason: round.winReason,
    aces: [],
    multiKills: [],
    clutch: null,
    openingPick: null,
    ninjaDefuse: null,
    notableKills: [],
  };
  
  // Detect aces
  highlights.aces = detectAces(events, players);
  
  // Detect multi-kills for each player
  players.forEach(player => {
    const multiKills = detectMultiKills(events, player.steamId);
    multiKills.forEach(mk => {
      highlights.multiKills.push({
        type: getMultiKillType(mk.count),
        steamId: player.steamId,
        playerName: player.playerName,
        team: player.team,
        count: mk.count,
        startTick: mk.startTick,
        endTick: mk.endTick,
        roundNumber: round.roundNumber,
      });
    });
  });
  
  // Detect clutch
  highlights.clutch = detectClutch(events, round, players);
  
  // Detect opening pick
  highlights.openingPick = detectOpeningPick(events, players);
  
  // Detect ninja defuse
  highlights.ninjaDefuse = detectNinjaDefuse(round, events, players);
  
  return highlights;
}

/**
 * Rank highlights by importance for the match summary
 * @param {Array} allHighlights - All highlights from all rounds
 * @returns {Array} - Sorted highlights by importance
 */
export function rankHighlightsByImportance(allHighlights) {
  const weights = {
    ace: 100,
    clutch: 80,
    quad_kill: 60,
    ninja_defuse: 70,
    triple_kill: 40,
    double_kill: 10,
    opening_pick: 5,
    wallbang: 15,
  };
  
  const flatHighlights = [];
  
  allHighlights.forEach(roundHighlights => {
    // Add aces
    roundHighlights.aces.forEach(h => {
      flatHighlights.push({ ...h, weight: weights.ace });
    });
    
    // Add multi-kills (excluding aces which are already added)
    roundHighlights.multiKills
      .filter(mk => mk.type !== 'ace')
      .forEach(h => {
        flatHighlights.push({ ...h, weight: weights[h.type] || 20 });
      });
    
    // Add clutch
    if (roundHighlights.clutch) {
      const clutchWeight = weights.clutch + (roundHighlights.clutch.killsInClutch * 10);
      flatHighlights.push({ ...roundHighlights.clutch, weight: clutchWeight });
    }
    
    // Add ninja defuse
    if (roundHighlights.ninjaDefuse) {
      flatHighlights.push({ ...roundHighlights.ninjaDefuse, weight: weights.ninja_defuse });
    }
  });
  
  return flatHighlights.sort((a, b) => b.weight - a.weight);
}

/**
 * Get top N highlights from a match
 * @param {Array} allHighlights - All highlights
 * @param {number} topN - Number of top highlights to return
 * @returns {Array} - Top highlights
 */
export function getTopHighlights(allHighlights, topN = 10) {
  const ranked = rankHighlightsByImportance(allHighlights);
  return ranked.slice(0, topN);
}

export default {
  detectMultiKills,
  detectAces,
  getMultiKillType,
  detectClutch,
  detectOpeningPick,
  detectNinjaDefuse,
  detectWallbangs,
  analyzeRoundHighlights,
  rankHighlightsByImportance,
  getTopHighlights,
};




