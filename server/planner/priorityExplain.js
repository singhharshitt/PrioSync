/**
 * Explainable priority - deterministic and pure.
 *
 * Turns the engine's score breakdown into a reusable explanation object for
 * API consumers and the UI:
 *   { factors, positiveFactors, negativeFactors, info, summary }
 * Positive/negative splits are by sign; `info` carries scheduling context
 * (e.g. downstream unlocks) that is HONESTLY marked as not part of the score.
 *
 * Input: { breakdown: { urgencyContrib, importanceContrib, deadlineContrib,
 *          easeContrib, blockedPenalty }, blocked, unlocks }
 */
export const buildPriorityExplanation = ({ breakdown = {}, blocked = false, unlocks = 0 } = {}) => {
    const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
    const factors = [
        { code: 'deadline', label: 'Deadline pressure', points: num(breakdown.deadlineContrib) },
        { code: 'urgency', label: 'Urgency', points: num(breakdown.urgencyContrib) },
        { code: 'importance', label: 'Importance', points: num(breakdown.importanceContrib) },
        { code: 'ease', label: 'Ease bonus', points: num(breakdown.easeContrib) },
    ];
    if (blocked && num(breakdown.blockedPenalty) !== 0) {
        factors.push({
            code: 'blocked',
            label: 'Blocked by unfinished dependencies',
            points: num(breakdown.blockedPenalty),
        });
    }
    const positiveFactors = factors.filter((f) => f.points > 0).sort((a, b) => b.points - a.points);
    const negativeFactors = factors.filter((f) => f.points < 0).sort((a, b) => a.points - b.points);

    const info = [];
    if (unlocks > 0) {
        info.push({
            code: 'unlocks',
            label: `Unlocks ${unlocks} downstream task${unlocks === 1 ? '' : 's'}`,
            note: 'Scheduling weight used by the engine - not part of the numeric score.',
        });
    }

    const fmt = (f) => `${f.label} (${f.points > 0 ? '+' : ''}${f.points})`;
    let summary;
    if (positiveFactors.length === 0 && negativeFactors.length === 0) {
        summary = 'No scoring factors apply to this task yet.';
    } else if (negativeFactors.length === 0) {
        summary = `${fmt(positiveFactors[0])} drives this score${positiveFactors[1] ? `, followed by ${fmt(positiveFactors[1])}.` : '.'}`;
    } else {
        const top = positiveFactors[0] ? `${fmt(positiveFactors[0])} drives this score` : 'This score has no positive drivers';
        summary = `${top}, but ${negativeFactors.map(fmt).join(', ')} pulls it down.`;
    }
    if (unlocks > 0) summary += ` It also unlocks ${unlocks} downstream task${unlocks === 1 ? '' : 's'}.`;

    return { factors, positiveFactors, negativeFactors, info, summary };
};
