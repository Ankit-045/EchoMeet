const express = require('express');
const Summary = require('../models/Summary');
const { auth } = require('../middleware/auth');
const { validateGenerateSummary } = require('../middleware/validate');

const router = express.Router();

// Generate summary from transcript
router.post('/generate', auth, validateGenerateSummary, async (req, res) => {
  try {
    const { roomId, roomName, transcript, participantCount, duration } = req.body;

    if (!transcript || transcript.trim().length === 0) {
      return res.status(400).json({ error: 'Transcript is empty' });
    }

    // AI Processing: Extract key points and action items
    const processed = processTranscript(transcript);

    const summary = new Summary({
      roomId,
      roomName,
      host: req.user._id,
      transcript,
      summary: processed.summary,
      keyPoints: processed.keyPoints,
      actionItems: processed.actionItems,
      duration,
      participantCount
    });

    await summary.save();
    res.status(201).json({ summary });
  } catch (error) {
    console.error('Summary generation error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Get all summaries for user — MUST be before /:roomId to avoid matching 'my' as roomId
router.get('/my/all', auth, async (req, res) => {
  try {
    const summaries = await Summary.find({ host: req.user._id })
      .sort({ generatedAt: -1 })
      .limit(50);

    res.json({ summaries });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summaries' });
  }
});

// Get summaries for a room
router.get('/:roomId', auth, async (req, res) => {
  try {
    const summaries = await Summary.find({ roomId: req.params.roomId })
      .populate('host', 'name email')
      .sort({ generatedAt: -1 });

    res.json({ summaries });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summaries' });
  }
});

/**
 * AI Transcript Processor
 * Extracts summary, key points, and action items from meeting transcript.
 * Uses NLP heuristics; in production, replace with BERT API call.
 */
function processTranscript(transcript) {
  const sentences = transcript
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  // Extract key points - sentences with important keywords
  const importantKeywords = [
    'decided', 'agreed', 'important', 'deadline', 'milestone', 'goal',
    'priority', 'action', 'need to', 'must', 'should', 'will',
    'plan', 'strategy', 'budget', 'timeline', 'project', 'task',
    'complete', 'deliver', 'review', 'approve', 'schedule', 'meeting',
    'update', 'progress', 'issue', 'problem', 'solution', 'propose',
    'recommend', 'conclude', 'summarize', 'next steps', 'follow up'
  ];

  const actionKeywords = [
    'need to', 'must', 'should', 'will', 'action', 'task',
    'assign', 'responsible', 'deadline', 'due', 'complete by',
    'follow up', 'next step', 'todo', 'to do', 'action item'
  ];

  // Score sentences by importance
  const scoredSentences = sentences.map(sentence => {
    const lower = sentence.toLowerCase();
    let score = 0;
    importantKeywords.forEach(kw => {
      if (lower.includes(kw)) score += 2;
    });
    // Longer sentences tend to be more informative
    if (sentence.length > 50) score += 1;
    if (sentence.length > 100) score += 1;
    return { sentence, score };
  });

  // Key points: top scored sentences
  const keyPoints = scoredSentences
    .filter(s => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(s => s.sentence);

  // If no key points found by keywords, take first few sentences
  if (keyPoints.length === 0 && sentences.length > 0) {
    keyPoints.push(...sentences.slice(0, Math.min(5, sentences.length)));
  }

  // Extract action items
  const actionItems = [];
  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();
    const isAction = actionKeywords.some(kw => lower.includes(kw));
    if (isAction) {
      // Try to extract assignee (look for names/pronouns before action words)
      let assignee = 'Team';
      const nameMatch = sentence.match(/(\w+)\s+(need|must|should|will)\s/i);
      if (nameMatch && nameMatch[1].length > 2) {
        assignee = nameMatch[1];
      }

      // Try to extract deadline
      let deadline = '';
      const dateMatch = sentence.match(
        /(by|before|until|due)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}|\w+\s+\d{1,2})/i
      );
      if (dateMatch) {
        deadline = dateMatch[2];
      }

      actionItems.push({
        item: sentence,
        assignee,
        deadline
      });
    }
  });

  // Generate summary
  const summaryPoints = keyPoints.slice(0, 4);
  const summary = summaryPoints.length > 0
    ? `Meeting Summary: ${summaryPoints.join('. ')}.`
    : 'No significant discussion points were identified in this meeting.';

  return {
    summary,
    keyPoints,
    actionItems: actionItems.slice(0, 10)
  };
}

module.exports = router;
