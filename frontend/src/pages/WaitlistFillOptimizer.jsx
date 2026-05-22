import { useEffect, useState } from 'react';

export default function WaitlistFillOptimizer() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/waitlist-fill-optimizer')
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Waitlist Fill Optimizer</h1>
      <p className="text-gray-600 mb-6">Rank waitlisted patients for cancellations by urgency, travel time, and channel likelihood.</p>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {data && Object.entries(data.summary).map(([key, value]) => (
          <div key={key} className="bg-white border rounded-lg p-4">
            <div className="text-xs uppercase text-gray-500">{key.replaceAll('_', ' ')}</div>
            <div className="text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border rounded-lg">
        {(data?.recommendations || []).map((rec) => (
          <div key={`${rec.slot}-${rec.candidate}`} className="p-4 border-b">
            <strong>{rec.slot} - {rec.provider}</strong>
            <div>{rec.candidate} - fit {rec.fit_score}% - {rec.channel}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
