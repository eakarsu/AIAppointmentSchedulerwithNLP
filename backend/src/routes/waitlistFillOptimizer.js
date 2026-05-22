import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    summary: { cancellations_today: 6, waitlist_candidates: 23, fillable_slots: 5, projected_revenue_saved: 1420 },
    recommendations: [
      { slot: '09:30', provider: 'Dr. Alvarez', candidate: 'Riley Stone', fit_score: 96, channel: 'sms' },
      { slot: '13:00', provider: 'Dana Kim', candidate: 'Morgan Fox', fit_score: 91, channel: 'email' },
      { slot: '16:15', provider: 'Dr. Shah', candidate: 'Avery Lin', fit_score: 84, channel: 'voice' },
    ],
  });
});

router.post('/rank', (req, res) => {
  const { urgency = 'routine', travelMinutes = 20 } = req.body || {};
  const score = (urgency === 'urgent' ? 70 : 45) + Math.max(0, 30 - travelMinutes);
  res.json({ score, recommendation: score > 70 ? 'offer slot immediately' : 'keep on standby list' });
});

export default router;
