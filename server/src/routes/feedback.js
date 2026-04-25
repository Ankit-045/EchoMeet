const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { auth } = require('../middleware/auth');

// @route   POST /api/feedback
// @desc    Submit meeting feedback
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { meetingId, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Valid rating (1-5) is required' });
    }

    const feedback = new Feedback({
      meetingId,
      user: req.user.id,
      userName: req.user.name,
      rating,
      comment
    });

    await feedback.save();
    res.status(201).json(feedback);
  } catch (err) {
    console.error('Feedback Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/feedback/recent
// @desc    Get recent high-rated feedback for landing page
// @access  Public
router.get('/recent', async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ rating: { $gte: 4 } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('userName rating comment createdAt');
    
    res.json(feedbacks);
  } catch (err) {
    console.error('Recent Feedback Error:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
