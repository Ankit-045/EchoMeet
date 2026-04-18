/**
 * Input validation middleware for EchoMeet API routes.
 * Uses lightweight regex checks — no external dependencies.
 */

const { EMAIL_REGEX, validateRoomId } = require('../lib/validation/common');

function validateBody(rules) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = req.body[field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
        continue;
      }

      if (rule.type === 'number' && typeof value !== 'number') {
        errors.push(`${field} must be a number`);
        continue;
      }

      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${field} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${field} must be at most ${rule.maxLength} characters`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${field} has invalid format`);
        }
        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
        }
      }

      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${field} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${field} must be at most ${rule.max}`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    // Sanitize string fields — strip control characters
    for (const [field, rule] of Object.entries(rules)) {
      if (rule.type === 'string' && typeof req.body[field] === 'string') {
        req.body[field] = req.body[field].trim();
      }
    }

    next();
  };
}

function validateRoomIdParam(req, res, next) {
  const roomId = String(req.params.roomId || '').trim().toUpperCase();
  if (!validateRoomId(roomId)) {
    return res.status(400).json({ error: 'Invalid meeting code format' });
  }
  req.params.roomId = roomId;
  return next();
}

// Pre-built validators for common routes
const validateRegister = validateBody({
  name: { required: true, type: 'string', minLength: 2, maxLength: 50 },
  email: { required: true, type: 'string', pattern: EMAIL_REGEX, maxLength: 100 },
  password: { required: true, type: 'string', minLength: 6, maxLength: 128 },
});

const validateLogin = validateBody({
  email: { required: true, type: 'string', pattern: EMAIL_REGEX },
  password: { required: true, type: 'string', minLength: 1 },
});

const validateGuestAccess = validateBody({
  name: { type: 'string', maxLength: 50 },
});

const validateGoogleSignIn = validateBody({
  credential: { required: true, type: 'string', minLength: 20 },
});

const validateCreateRoom = validateBody({
  name: { type: 'string', maxLength: 100 },
});

const validateJoinRoom = validateBody({
  guestName: { type: 'string', maxLength: 50 },
});

const validateGenerateSummary = validateBody({
  roomId: { required: true, type: 'string', maxLength: 20 },
  transcript: { required: true, type: 'string', minLength: 10, maxLength: 500000 },
  participantCount: { type: 'number', min: 1, max: 1000 },
  duration: { type: 'number', min: 0 },
});

const validateRoomSettings = validateBody({
  settings: { required: true },
});

module.exports = {
  validateBody,
  validateRoomIdParam,
  validateRegister,
  validateLogin,
  validateGuestAccess,
  validateGoogleSignIn,
  validateCreateRoom,
  validateJoinRoom,
  validateGenerateSummary,
  validateRoomSettings,
};
