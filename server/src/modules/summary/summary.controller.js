const summaryService = require('./summary.service');

async function generateSummary(req, res) {
    try {
        const data = await summaryService.generateSummary({ ...req.body, user: req.user });
        res.status(201).json(data);
    } catch (error) {
        if (error && error.status && error.body) {
            return res.status(error.status).json(error.body);
        }
        console.error('Summary generation error:', error);
        res.status(500).json({ error: 'Failed to generate summary' });
    }
}

async function getMySummaries(req, res) {
    try {
        const data = await summaryService.getMySummaries(req.user);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch summaries' });
    }
}

async function getRoomSummaries(req, res) {
    try {
        const data = await summaryService.getRoomSummaries(req.params.roomId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch summaries' });
    }
}

module.exports = {
    generateSummary,
    getMySummaries,
    getRoomSummaries,
};
