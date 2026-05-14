import React, { useEffect, useState } from 'react';
import { aiExtrasApi, appointmentsApi } from '../services/api';

const tabs = [
  { id: 'tz', label: 'TZ Reschedule', icon: '🌍' },
  { id: 'duration', label: 'Duration Predict', icon: '⏱️' },
  { id: 'heatmap', label: 'Heatmap', icon: '🔥' },
  { id: 'transcript', label: 'Transcript', icon: '📝' },
  { id: 'sentiment', label: 'Sentiment', icon: '😊' },
  { id: 'recurring', label: 'Recurring', icon: '🔁' },
  { id: 'roi', label: 'Meeting ROI', icon: '💰' },
  { id: 'consensus', label: 'Team Consensus', icon: '🤝' },
  // Apply pass 5 backlog
  { id: 'cancel', label: 'Cancel Predict', icon: '🚫' },
  { id: 'satisfaction', label: 'Satisfaction', icon: '⭐' },
  { id: 'optimal', label: 'Optimal Time', icon: '🎯' },
];

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function ResultBlock({ data }) {
  if (!data) return null;
  return (
    <pre className="mt-4 bg-gray-900 text-green-200 p-4 rounded-lg overflow-x-auto text-xs">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function AIExtras() {
  const [tab, setTab] = useState('tz');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Per-tab form state
  const [aptId, setAptId] = useState('');
  const [toTz, setToTz] = useState('America/Los_Angeles');
  const [fromTz, setFromTz] = useState('America/New_York');
  const [title, setTitle] = useState('Standup');
  const [type, setType] = useState('internal');
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [ratings, setRatings] = useState('5,4,3,5');
  const [salary, setSalary] = useState(75);
  const [attendees, setAttendees] = useState(5);
  const [agenda, setAgenda] = useState('Status updates, blockers');
  const [duration, setDuration] = useState(30);
  const [teamAvail, setTeamAvail] = useState('[]');
  // Apply pass 5 backlog state
  const [satRating, setSatRating] = useState(4);
  const [satFeedback, setSatFeedback] = useState('');
  const [optTitle, setOptTitle] = useState('Quarterly Review');
  const [optDuration, setOptDuration] = useState(60);
  const [optLocation, setOptLocation] = useState('');

  useEffect(() => {
    appointmentsApi.getUpcoming().then(setAppointments).catch(() => setAppointments([]));
  }, []);

  const run = async (fn) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fn();
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderTab = () => {
    switch (tab) {
      case 'tz':
        return (
          <Card title="Time-zone Smart Rescheduling">
            <p className="text-sm text-gray-500 mb-4">Re-suggest a meeting time when you (or attendees) cross timezones.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={aptId} onChange={(e) => setAptId(e.target.value)} className="border rounded-lg px-3 py-2">
                <option value="">Select appointment…</option>
                {appointments.map((a) => (<option key={a.id} value={a.id}>{a.title}</option>))}
              </select>
              <input value={fromTz} onChange={(e) => setFromTz(e.target.value)} placeholder="From TZ (IANA)" className="border rounded-lg px-3 py-2" />
              <input value={toTz} onChange={(e) => setToTz(e.target.value)} placeholder="To TZ (IANA)" className="border rounded-lg px-3 py-2" />
            </div>
            <button
              disabled={!aptId || loading}
              onClick={() => run(() => aiExtrasApi.tzReschedule({ appointment_id: parseInt(aptId), from_timezone: fromTz, to_timezone: toTz }))}
              className="mt-3 px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Suggesting…' : '🌍 Suggest New Time'}
            </button>
          </Card>
        );
      case 'duration':
        return (
          <Card title="Meeting Duration Predictor">
            <p className="text-sm text-gray-500 mb-4">Predict realistic duration based on title/type and your history.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting title" className="border rounded-lg px-3 py-2" />
              <input value={type} onChange={(e) => setType(e.target.value)} placeholder="Type (internal/external/1on1)" className="border rounded-lg px-3 py-2" />
            </div>
            <button
              disabled={!title || loading}
              onClick={() => run(() => aiExtrasApi.durationPredict({ title, type }))}
              className="mt-3 px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Predicting…' : '⏱️ Predict Duration'}
            </button>
          </Card>
        );
      case 'heatmap':
        return (
          <Card title="Calendar Heatmap">
            <p className="text-sm text-gray-500 mb-4">Visualise your busiest hours/days to find underbooked windows.</p>
            <button onClick={() => run(() => aiExtrasApi.heatmap())} className="px-5 py-2 bg-blue-600 text-white rounded-lg">
              🔥 Build Heatmap
            </button>
            {result?.heatmap && (
              <div className="mt-6 overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="p-1"></th>
                      {Array.from({ length: 24 }, (_, h) => (<th key={h} className="p-1 text-center">{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.heatmap.map((row) => (
                      <tr key={row.day_index}>
                        <td className="p-1 font-semibold text-gray-600">{row.day}</td>
                        {row.hours.map((cell) => {
                          const intensity = Math.min(cell.count / (result.max_count || 1), 1);
                          const bg = `rgba(59, 130, 246, ${intensity.toFixed(2)})`;
                          return (
                            <td key={cell.hour} title={`${cell.count} appts`} style={{ background: bg }} className="w-6 h-6 text-center text-[10px]">
                              {cell.count || ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      case 'transcript':
        return (
          <Card title="Meeting Transcript Summarizer">
            <p className="text-sm text-gray-500 mb-4">Paste a transcript snippet — get summary, decisions, and action items.</p>
            <select value={aptId} onChange={(e) => setAptId(e.target.value)} className="border rounded-lg px-3 py-2 mb-2 w-full">
              <option value="">Optional: link to appointment…</option>
              {appointments.map((a) => (<option key={a.id} value={a.id}>{a.title}</option>))}
            </select>
            <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste meeting transcript…" rows={6} className="w-full border rounded-lg px-3 py-2" />
            <button
              disabled={!transcript || loading}
              onClick={() => run(() => aiExtrasApi.summarize({ transcript, appointment_id: aptId ? parseInt(aptId) : null }))}
              className="mt-3 px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Summarising…' : '📝 Summarise'}
            </button>
          </Card>
        );
      case 'sentiment':
        return (
          <Card title="Attendee Sentiment Checker">
            <p className="text-sm text-gray-500 mb-4">Submit attendee ratings + free text — get themed sentiment analysis.</p>
            <select value={aptId} onChange={(e) => setAptId(e.target.value)} className="border rounded-lg px-3 py-2 mb-2 w-full">
              <option value="">Optional: link to appointment…</option>
              {appointments.map((a) => (<option key={a.id} value={a.id}>{a.title}</option>))}
            </select>
            <input value={ratings} onChange={(e) => setRatings(e.target.value)} placeholder="Ratings 1-5 (comma-separated)" className="w-full border rounded-lg px-3 py-2 mb-2" />
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Free-form feedback…" rows={4} className="w-full border rounded-lg px-3 py-2" />
            <button
              disabled={loading}
              onClick={() => {
                const ratingArr = ratings.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
                run(() => aiExtrasApi.sentiment({ feedback_text: feedback, ratings: ratingArr, appointment_id: aptId ? parseInt(aptId) : null }));
              }}
              className="mt-3 px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Analysing…' : '😊 Analyse Sentiment'}
            </button>
          </Card>
        );
      case 'recurring':
        return (
          <Card title="Smart Recurring Pattern detection">
            <p className="text-sm text-gray-500 mb-4">Detect patterns in past appointments → propose recurring series.</p>
            <button disabled={loading} onClick={() => run(() => aiExtrasApi.recurringPatterns())} className="px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
              {loading ? 'Detecting…' : '🔁 Detect Patterns'}
            </button>
          </Card>
        );
      case 'roi':
        return (
          <Card title="Meeting Value ROI">
            <p className="text-sm text-gray-500 mb-4">Estimate cost vs value for a meeting.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={aptId} onChange={(e) => setAptId(e.target.value)} className="border rounded-lg px-3 py-2">
                <option value="">Select appointment…</option>
                {appointments.map((a) => (<option key={a.id} value={a.id}>{a.title}</option>))}
              </select>
              <input type="number" value={salary} onChange={(e) => setSalary(parseInt(e.target.value))} placeholder="Salary $/hr" className="border rounded-lg px-3 py-2" />
              <input type="number" value={attendees} onChange={(e) => setAttendees(parseInt(e.target.value))} placeholder="Attendees" className="border rounded-lg px-3 py-2" />
            </div>
            <input value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="Agenda topics" className="w-full border rounded-lg px-3 py-2 mt-2" />
            <button
              disabled={!aptId || loading}
              onClick={() => run(() => aiExtrasApi.meetingROI({ appointment_id: parseInt(aptId), salary_proxy_per_hour: salary, attendee_count: attendees, agenda_topics: agenda.split(',') }))}
              className="mt-3 px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Computing…' : '💰 Compute ROI'}
            </button>
          </Card>
        );
      case 'consensus':
        return (
          <Card title="Cross-Team Calendar Consensus">
            <p className="text-sm text-gray-500 mb-4">Provide team availabilities (JSON) → AI ranks best slots.</p>
            <textarea value={teamAvail} onChange={(e) => setTeamAvail(e.target.value)} placeholder='[{"team":"Eng","slots":["2026-05-04T10:00Z"]}]' rows={6} className="w-full border rounded-lg px-3 py-2 font-mono text-xs" />
            <input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} placeholder="Duration min" className="border rounded-lg px-3 py-2 mt-2" />
            <button
              disabled={loading}
              onClick={() => {
                let parsed;
                try { parsed = JSON.parse(teamAvail); } catch { setError('Invalid JSON'); return; }
                run(() => aiExtrasApi.teamConsensus({ team_availabilities: parsed, duration_minutes: duration, date_range: { start: new Date().toISOString(), end: new Date(Date.now() + 7 * 86400000).toISOString() } }));
              }}
              className="mt-3 px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Ranking…' : '🤝 Rank Slots'}
            </button>
          </Card>
        );
      case 'cancel':
        return (
          <Card title="Cancellation Prediction">
            <p className="text-sm text-gray-500 mb-4">Estimate the probability the selected appointment is cancelled (requires OPENROUTER_API_KEY).</p>
            <select value={aptId} onChange={(e) => setAptId(e.target.value)} className="border rounded-lg px-3 py-2 mb-2 w-full">
              <option value="">Select appointment…</option>
              {appointments.map((a) => (<option key={a.id} value={a.id}>{a.title}</option>))}
            </select>
            <button
              disabled={!aptId || loading}
              onClick={() => run(() => aiExtrasApi.cancellationPredict({ appointment_id: parseInt(aptId) }))}
              className="mt-3 px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Predicting…' : '🚫 Predict Cancellation'}
            </button>
          </Card>
        );
      case 'satisfaction':
        return (
          <Card title="Satisfaction Score">
            <p className="text-sm text-gray-500 mb-4">Score post-appointment satisfaction from a 1-5 rating + free text. Requires OPENROUTER_API_KEY.</p>
            <select value={aptId} onChange={(e) => setAptId(e.target.value)} className="border rounded-lg px-3 py-2 mb-2 w-full">
              <option value="">Optional: link to appointment…</option>
              {appointments.map((a) => (<option key={a.id} value={a.id}>{a.title}</option>))}
            </select>
            <input type="number" min={1} max={5} value={satRating} onChange={(e) => setSatRating(parseInt(e.target.value))} placeholder="Rating 1-5" className="border rounded-lg px-3 py-2 mb-2" />
            <textarea value={satFeedback} onChange={(e) => setSatFeedback(e.target.value)} placeholder="Free-form feedback…" rows={4} className="w-full border rounded-lg px-3 py-2" />
            <button
              disabled={!satRating || loading}
              onClick={() => run(() => aiExtrasApi.satisfactionScore({ appointment_id: aptId ? parseInt(aptId) : null, rating: satRating, feedback_text: satFeedback }))}
              className="mt-3 px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Scoring…' : '⭐ Score Satisfaction'}
            </button>
          </Card>
        );
      case 'optimal':
        return (
          <Card title="Optimal Time Suggestion">
            <p className="text-sm text-gray-500 mb-4">LLM-based time suggestion. Travel-time qualitative only (no Maps API). Requires OPENROUTER_API_KEY.</p>
            <input value={optTitle} onChange={(e) => setOptTitle(e.target.value)} placeholder="Meeting title" className="w-full border rounded-lg px-3 py-2 mb-2" />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input type="number" value={optDuration} onChange={(e) => setOptDuration(parseInt(e.target.value))} placeholder="Duration (min)" className="border rounded-lg px-3 py-2" />
              <input value={optLocation} onChange={(e) => setOptLocation(e.target.value)} placeholder="Location hint (e.g., 'downtown SF')" className="border rounded-lg px-3 py-2" />
            </div>
            <button
              disabled={!optTitle || loading}
              onClick={() => run(() => aiExtrasApi.optimalTimeSuggest({ title: optTitle, duration_minutes: optDuration, location_hint: optLocation }))}
              className="mt-3 px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Suggesting…' : '🎯 Suggest Optimal Time'}
            </button>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-3xl">✨</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Extras</h1>
            <p className="opacity-90">8 NEW custom AI features (audit-proposed)</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setResult(null); setError(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${tab === t.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
          >
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {renderTab()}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}
      {result && (
        <Card title="Result">
          <ResultBlock data={result} />
        </Card>
      )}
    </div>
  );
}
