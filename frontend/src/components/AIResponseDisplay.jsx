import React from 'react';

// Beautiful AI Response Display Component
// Renders AI responses in a professional, readable format instead of raw JSON

export function AIResponseDisplay({ data, type = 'default', title = 'AI Analysis' }) {
  if (!data) return null;

  const getGradient = () => {
    switch (type) {
      case 'buffer': return 'from-cyan-500 to-blue-600';
      case 'noshow': return 'from-orange-500 to-red-600';
      case 'reschedule': return 'from-purple-500 to-pink-600';
      case 'resource': return 'from-emerald-500 to-teal-600';
      case 'conflict': return 'from-red-500 to-orange-600';
      default: return 'from-indigo-500 to-purple-600';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-r ${getGradient()} p-4 text-white`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="text-xl">🤖</span>
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm opacity-90">AI-Powered Analysis</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {renderContent(data, type)}
      </div>
    </div>
  );
}

function renderContent(data, type) {
  // Handle different response types
  if (typeof data === 'string') {
    return <p className="text-gray-700">{data}</p>;
  }

  if (data.text) {
    return <p className="text-gray-700">{data.text}</p>;
  }

  if (data.response) {
    return (
      <div className="space-y-4">
        <p className="text-gray-700 text-lg">{data.response}</p>
        {data.suggestions && data.suggestions.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Suggestions:</p>
            <ul className="space-y-1">
              {data.suggestions.map((s, i) => (
                <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                  <span className="text-blue-500">→</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Render object properties beautifully
  return (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => {
        if (key === 'ai_powered') return null;
        return <PropertyRenderer key={key} propKey={key} value={value} />;
      })}
    </div>
  );
}

function PropertyRenderer({ propKey, value }) {
  const formatKey = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return null;

    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{formatKey(propKey)}</h4>
        <div className="space-y-2">
          {value.map((item, index) => (
            <ArrayItemRenderer key={index} item={item} index={index} />
          ))}
        </div>
      </div>
    );
  }

  // Handle objects
  if (typeof value === 'object') {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{formatKey(propKey)}</h4>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">{formatKey(k)}</p>
              <p className="font-medium text-gray-800">
                {typeof v === 'number' ? (
                  v < 1 && v > 0 ? `${Math.round(v * 100)}%` : v
                ) : String(v)}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Handle numbers (scores/percentages)
  if (typeof value === 'number') {
    const isPercentage = value <= 1 && value >= 0;
    const displayValue = isPercentage ? `${Math.round(value * 100)}%` : value;
    const isGood = isPercentage && value >= 0.7;
    const isMedium = isPercentage && value >= 0.4 && value < 0.7;

    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-600">{formatKey(propKey)}</span>
        <div className="flex items-center gap-2">
          {isPercentage && (
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isGood ? 'bg-green-500' : isMedium ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${value * 100}%` }}
              />
            </div>
          )}
          <span className={`font-semibold ${isGood ? 'text-green-600' : isMedium ? 'text-yellow-600' : 'text-gray-800'}`}>
            {displayValue}
          </span>
        </div>
      </div>
    );
  }

  // Handle strings
  if (typeof value === 'string') {
    // Check if it's a long text (reasoning)
    if (propKey.includes('reasoning') || propKey.includes('summary') || value.length > 100) {
      return (
        <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg p-4 border border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span>💡</span> {formatKey(propKey)}
          </h4>
          <p className="text-gray-700 leading-relaxed">{value}</p>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-600">{formatKey(propKey)}</span>
        <span className="font-medium text-gray-800">{value}</span>
      </div>
    );
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-600">{formatKey(propKey)}</span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {value ? 'Yes' : 'No'}
        </span>
      </div>
    );
  }

  return null;
}

function ArrayItemRenderer({ item, index }) {
  if (typeof item === 'string') {
    return (
      <div className="flex items-start gap-2 p-2 bg-white rounded-lg">
        <span className="text-blue-500 font-bold">{index + 1}.</span>
        <span className="text-gray-700">{item}</span>
      </div>
    );
  }

  if (typeof item === 'object') {
    return (
      <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
            {index + 1}
          </div>
          <div className="flex-1 space-y-1">
            {Object.entries(item).map(([k, v]) => {
              if (k === 'index' || k === 'appointment_index') return null;

              const formatKey = (key) => key.replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());

              if (typeof v === 'number' && v <= 1 && v >= 0) {
                return (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{formatKey(k)}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${v >= 0.7 ? 'bg-green-500' : v >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${v * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{Math.round(v * 100)}%</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={k} className="flex items-start justify-between">
                  <span className="text-xs text-gray-500">{formatKey(k)}</span>
                  <span className="text-sm text-gray-800 text-right max-w-[60%]">{String(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 bg-white rounded-lg text-gray-700">
      {JSON.stringify(item)}
    </div>
  );
}

// Stat Card Component for displaying metrics
export function AIStatCard({ label, value, icon, color = 'blue', subtitle }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    orange: 'bg-orange-50 text-orange-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    teal: 'bg-teal-50 text-teal-600'
  };

  return (
    <div className={`rounded-xl p-5 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm opacity-80">{label}</p>
      {subtitle && <p className="text-xs opacity-60 mt-1">{subtitle}</p>}
    </div>
  );
}

// Progress Bar Component
export function AIProgressBar({ value, label, color = 'blue' }) {
  const percent = typeof value === 'number' ? (value > 1 ? value : value * 100) : 0;

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    cyan: 'bg-cyan-500',
    orange: 'bg-orange-500'
  };

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">{label}</span>
          <span className="font-medium text-gray-800">{Math.round(percent)}%</span>
        </div>
      )}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// Tip/Recommendation Card
export function AITipCard({ tips = [], title = 'AI Recommendations' }) {
  if (!tips || tips.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5 border border-amber-100">
      <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
        <span>💡</span> {title}
      </h4>
      <ul className="space-y-2">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
            <span className="text-amber-500 mt-0.5">→</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AIResponseDisplay;
