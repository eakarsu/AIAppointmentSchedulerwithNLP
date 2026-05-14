import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '../services/api';

function useDebounce(fn, delay) {
  const timer = React.useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults(null); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await searchApi.search(q);
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useDebounce(runSearch, 400);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    debouncedSearch(q);
  };

  const statusColor = (status) => {
    const map = { scheduled: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-600', 'no-show': 'bg-red-100 text-red-700' };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-gray-700 to-gray-900 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Unified Search</h1>
        <p className="opacity-80 text-sm">Search across appointments, contacts, and categories at once</p>
      </div>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">&#128269;</span>
        <input
          value={query}
          onChange={handleChange}
          placeholder="Type to search (appointments, contacts, categories)..."
          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm animate-pulse">Searching...</span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {results && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{results.total} result{results.total !== 1 ? 's' : ''} for &quot;{results.query}&quot;</p>

          {/* Appointments */}
          {results.results.appointments.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Appointments ({results.results.appointments.length})</h2>
              <div className="space-y-2">
                {results.results.appointments.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => navigate('/appointments')}
                    className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm hover:shadow-md cursor-pointer transition"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{a.title}</p>
                      <p className="text-xs text-gray-500">{a.start_time ? new Date(a.start_time).toLocaleString() : ''} {a.location ? `· ${a.location}` : ''}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(a.status)}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Contacts */}
          {results.results.contacts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Contacts ({results.results.contacts.length})</h2>
              <div className="space-y-2">
                {results.results.contacts.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate('/contacts')}
                    className="flex items-center gap-4 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm hover:shadow-md cursor-pointer transition"
                  >
                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-500">{[c.email, c.company].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Categories */}
          {results.results.categories.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Categories ({results.results.categories.length})</h2>
              <div className="flex flex-wrap gap-2">
                {results.results.categories.map((cat) => (
                  <span
                    key={cat.id}
                    onClick={() => navigate('/categories')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer hover:opacity-80 transition"
                    style={{ backgroundColor: cat.color + '22', color: cat.color, border: `1px solid ${cat.color}44` }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></span>
                    {cat.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {results.total === 0 && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">&#128269;</div>
              <p className="font-medium">No results found for &quot;{results.query}&quot;</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      )}

      {!results && !loading && query.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">&#128269;</div>
          <p className="text-lg font-medium">Start typing to search</p>
          <p className="text-sm mt-1">Search across appointments, contacts, and categories</p>
        </div>
      )}
    </div>
  );
}
