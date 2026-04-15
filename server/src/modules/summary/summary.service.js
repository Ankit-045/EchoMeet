const Summary = require('../../models/Summary');

function processTranscript(transcript) {
    const sentences = transcript
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 10);

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

    const scoredSentences = sentences.map(sentence => {
        const lower = sentence.toLowerCase();
        let score = 0;
        importantKeywords.forEach(kw => {
            if (lower.includes(kw)) score += 2;
        });
        if (sentence.length > 50) score += 1;
        if (sentence.length > 100) score += 1;
        return { sentence, score };
    });

    const keyPoints = scoredSentences
        .filter(s => s.score >= 2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(s => s.sentence);

    if (keyPoints.length === 0 && sentences.length > 0) {
        keyPoints.push(...sentences.slice(0, Math.min(5, sentences.length)));
    }

    const actionItems = [];
    sentences.forEach(sentence => {
        const lower = sentence.toLowerCase();
        const isAction = actionKeywords.some(kw => lower.includes(kw));
        if (isAction) {
            let assignee = 'Team';
            const nameMatch = sentence.match(/(\w+)\s+(need|must|should|will)\s/i);
            if (nameMatch && nameMatch[1].length > 2) {
                assignee = nameMatch[1];
            }

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

async function generateSummary({ roomId, roomName, transcript, participantCount, duration, user }) {
    if (!transcript || transcript.trim().length === 0) {
        throw { status: 400, body: { error: 'Transcript is empty' } };
    }

    const processed = processTranscript(transcript);

    const summary = new Summary({
        roomId,
        roomName,
        host: user._id,
        transcript,
        summary: processed.summary,
        keyPoints: processed.keyPoints,
        actionItems: processed.actionItems,
        duration,
        participantCount
    });

    await summary.save();
    return { summary };
}

async function getMySummaries(user) {
    const summaries = await Summary.find({ host: user._id })
        .select('roomId roomName summary keyPoints actionItems generatedAt duration participantCount')
        .sort({ generatedAt: -1 })
        .limit(50)
        .lean();

    return { summaries };
}

async function getRoomSummaries(roomId) {
    const summaries = await Summary.find({ roomId })
        .select('roomId roomName host summary keyPoints actionItems generatedAt duration participantCount')
        .populate('host', 'name email')
        .sort({ generatedAt: -1 })
        .lean();

    return { summaries };
}

module.exports = {
    generateSummary,
    getMySummaries,
    getRoomSummaries,
};
