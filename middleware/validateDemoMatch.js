/**
 * Validation middleware for demo match endpoints
 * @module middleware/validateDemoMatch
 */

/**
 * Validates demo match data for create/update operations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const validateDemoMatch = (req, res, next) => {
  const matchData = req.body;

  // Validate required fields
  const requiredFields = [
    'id',
    'tournamentId',
    'event',
    'stage',
    'fileName',
    'fileSizeMB',
    'map',
    'bestOf',
    'playedAt',
    'teams',
  ];

  const missingFields = requiredFields.filter((field) => {
    if (field === 'fileSizeMB' || field === 'bestOf') {
      return matchData[field] === undefined;
    }
    return !matchData[field];
  });

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: `Required fields: ${requiredFields.join(', ')}`,
      missing: missingFields,
    });
  }

  // Validate parseStatus if provided
  if (matchData.parseStatus !== undefined) {
    const validStatuses = ['pending', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(matchData.parseStatus)) {
      return res.status(400).json({
        error: 'Invalid parseStatus',
        details: `parseStatus must be one of: ${validStatuses.join(', ')}`,
      });
    }
  }

  // Validate bestOf
  if (typeof matchData.bestOf !== 'number' || matchData.bestOf < 1) {
    return res.status(400).json({
      error: 'Invalid bestOf value',
      details: 'bestOf must be a positive number',
    });
  }

  // Validate fileSizeMB
  if (typeof matchData.fileSizeMB !== 'number' || matchData.fileSizeMB < 0) {
    return res.status(400).json({
      error: 'Invalid fileSizeMB value',
      details: 'fileSizeMB must be a non-negative number',
    });
  }

  next();
};

export default validateDemoMatch;

