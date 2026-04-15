const meetingService = require('./meeting.service');

async function createMeeting(req, res) {
    try {
        const data = await meetingService.createMeeting({ ...req.body, user: req.user });
        res.status(201).json(data);
    } catch (error) {
        if (error && error.status && error.body) {
            return res.status(error.status).json(error.body);
        }
        console.error('Create meeting error:', error);
        res.status(500).json({ error: 'Failed to schedule meeting' });
    }
}

async function getMyMeetings(req, res) {
    try {
        const data = await meetingService.getMyMeetings(req.user);
        res.json(data);
    } catch (error) {
        console.error('Fetch meetings error:', error);
        res.status(500).json({ error: 'Failed to fetch meetings' });
    }
}

async function deleteMeeting(req, res) {
    try {
        const io = req.app.get('io');
        const data = await meetingService.deleteMeeting({ id: req.params.id, user: req.user, io });
        res.json(data);
    } catch (error) {
        if (error && error.status && error.body) {
            return res.status(error.status).json(error.body);
        }
        console.error('Delete meeting error:', error);
        res.status(500).json({ error: 'Failed to cancel meeting' });
    }
}

async function getActiveMeetings(req, res) {
    try {
        const data = await meetingService.getActiveMeetings();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch active meetings' });
    }
}

module.exports = {
    createMeeting,
    getMyMeetings,
    deleteMeeting,
    getActiveMeetings,
};
