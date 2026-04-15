const express = require('express');
const { auth } = require('../middleware/auth');
const { validateGenerateSummary } = require('../middleware/validate');
const {
  generateSummary,
  getMySummaries,
  getRoomSummaries,
} = require('../modules/summary/summary.controller');

const router = express.Router();

// Generate summary from transcript
router.post('/generate', auth, validateGenerateSummary, generateSummary);

// Get all summaries for user — MUST be before /:roomId to avoid matching 'my' as roomId
router.get('/my/all', auth, getMySummaries);

// Get summaries for a room
router.get('/:roomId', auth, getRoomSummaries);

module.exports = router;
