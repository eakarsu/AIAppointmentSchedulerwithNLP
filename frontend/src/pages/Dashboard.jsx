import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { appointmentsApi, aiApi } from '../services/api';

const featureCards = [
  { path: '/appointments', label: 'Appointments', icon: '📅', color: 'bg-blue-500', description: 'Manage your scheduled appointments' },
  { path: '/contacts', label: 'Contacts', icon: '👥', color: 'bg-green-500', description: 'Your contacts directory' },
  { path: '/categories', label: 'Categories', icon: '🏷️', color: 'bg-purple-500', description: 'Organize with categories' },
  { path: '/reminders', label: 'Reminders', icon: '🔔', color: 'bg-yellow-500', description: 'Never miss an appointment' },
  { path: '/nlp-logs', label: 'NLP Logs', icon: '🤖', color: 'bg-indigo-500', description: 'AI interaction history' },
  { path: '/voice-commands', label: 'Voice Commands', icon: '🎤', color: 'bg-pink-500', description: 'Voice control history' },
  { path: '/settings', label: 'Settings', icon: '⚙️', color: 'bg-gray-500', description: 'Configure your preferences' }
];

const aiFeatureCards = [
  { path: '/ai/buffer-optimizer', label: 'Buffer Optimizer', icon: '🕐', gradient: 'from-cyan-500 to-blue-600', description: 'Optimize time between appointments' },
  { path: '/ai/noshow-predictor', label: 'No-Show Predictor', icon: '📊', gradient: 'from-orange-500 to-red-600', description: 'Predict appointment no-shows' },
  { path: '/ai/reschedule-suggester', label: 'Reschedule Suggester', icon: '📅', gradient: 'from-purple-500 to-pink-600', description: 'AI-powered rescheduling' },
  { path: '/ai/resource-allocator', label: 'Resource Allocator', icon: '⚡', gradient: 'from-emerald-500 to-teal-600', description: 'Optimize resource allocation' },
  { path: '/ai/conflict-resolver', label: 'Conflict Resolver', icon: '🔀', gradient: 'from-rose-500 to-red-600', description: 'Detect and resolve scheduling conflicts' }
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showError } = useToast();
  const [nlpInput, setNlpInput] = useState('');
  const [nlpResult, setNlpResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [recognition, setRecognition] = useState(null);

  // AI Features State
  const [aiStatus, setAiStatus] = useState(null);
  const [insights, setInsights] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    loadUpcomingAppointments();
    initializeSpeechRecognition();
    checkAIStatus();
    loadInsights();
    loadSuggestions();
  }, []);

  const checkAIStatus = async () => {
    try {
      const status = await aiApi.getStatus();
      setAiStatus(status);
    } catch (err) {
      console.error('Failed to check AI status:', err);
    }
  };

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const data = await aiApi.getInsights('week');
      setInsights(data);
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      const data = await aiApi.getSuggestions('What are the best times to schedule appointments?');
      setSuggestions(data);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  };

  const loadUpcomingAppointments = async () => {
    try {
      const data = await appointmentsApi.getUpcoming();
      setUpcomingAppointments(data.slice(0, 5));
    } catch (err) {
      console.error('Failed to load appointments:', err);
    }
  };

  const initializeSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        setNlpInput(transcript);
        setListening(false);
        await handleNlpSubmit(transcript);
      };

      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setListening(false);
      };

      recognitionInstance.onend = () => {
        setListening(false);
      };

      setRecognition(recognitionInstance);
    }
  };

  const startListening = () => {
    if (recognition) {
      setListening(true);
      recognition.start();
    } else {
      showError('Speech recognition is not supported in this browser.');
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setListening(false);
    }
  };

  const handleNlpSubmit = async (text = nlpInput) => {
    if (!text.trim()) return;

    setLoading(true);
    try {
      const result = await appointmentsApi.createFromNlp(text);
      setNlpResult(result);

      if (result.appointment) {
        loadUpcomingAppointments();
        loadInsights();
      }
    } catch (err) {
      setNlpResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await aiApi.chat(userMessage);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: response.response || response.text || 'I understood your request.',
        suggestions: response.suggestions
      }]);
    } catch (err) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section with AI Status */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.name}!</h1>
            <p className="mt-2 opacity-90">Use natural language or voice to schedule appointments</p>
          </div>
          <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1">
            <span className={`w-2 h-2 rounded-full ${aiStatus?.configured ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
            <span className="text-sm">AI {aiStatus?.configured ? 'Active' : 'Limited'}</span>
          </div>
        </div>
      </div>

      {/* AI Insights Section */}
      {insights && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🧠</span>
            <h2 className="text-lg font-semibold text-gray-800">AI Schedule Insights</h2>
            {insights.ai_powered && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">AI Powered</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">This Week</p>
              <p className="text-2xl font-bold text-indigo-600">{insights.appointment_count || 0}</p>
              <p className="text-sm text-gray-600">appointments</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">Total Hours</p>
              <p className="text-2xl font-bold text-purple-600">{insights.total_hours || 0}h</p>
              <p className="text-sm text-gray-600">scheduled</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">Work-Life Balance</p>
              <p className="text-2xl font-bold text-green-600">{insights.work_life_balance || 7}/10</p>
              <p className="text-sm text-gray-600">score</p>
            </div>
          </div>
          {insights.summary && (
            <p className="mt-4 text-sm text-gray-600 bg-white rounded-lg p-3">{insights.summary}</p>
          )}
          {insights.productivity_tips && insights.productivity_tips.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">AI Tips:</p>
              <ul className="space-y-1">
                {insights.productivity_tips.slice(0, 3).map((tip, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-indigo-500">💡</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* NLP Input Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Schedule with AI</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={nlpInput}
            onChange={(e) => setNlpInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleNlpSubmit()}
            placeholder='Try: "Book me Tuesday afternoon" or "Schedule meeting with Dr. Sarah tomorrow at 2pm"'
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => handleNlpSubmit()}
            disabled={loading || !nlpInput.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Schedule'}
          </button>
          <button
            onClick={listening ? stopListening : startListening}
            className={`px-4 py-3 rounded-lg transition-colors ${
              listening
                ? 'bg-red-500 text-white voice-active'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={listening ? 'Stop listening' : 'Start voice input'}
          >
            🎤
          </button>
        </div>

        {listening && (
          <div className="mt-3 flex items-center text-blue-600">
            <span className="pulse-animation mr-2">●</span>
            Listening... Speak now
          </div>
        )}

        {nlpResult && (
          <div className={`mt-4 p-4 rounded-lg ${nlpResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            {nlpResult.error ? (
              <p className="text-red-700">{nlpResult.error}</p>
            ) : nlpResult.appointment ? (
              <div>
                <p className="text-green-700 font-medium">Appointment created successfully!</p>
                <p className="text-green-600 mt-1">{nlpResult.appointment.title} - {formatDate(nlpResult.appointment.start_time)}</p>
                {nlpResult.ai_powered && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full mt-2 inline-block">AI Powered</span>}
              </div>
            ) : (
              <div>
                <p className="text-blue-700 font-medium">Parsed result:</p>
                <pre className="text-sm text-gray-600 mt-1">{JSON.stringify(nlpResult.parsed || nlpResult, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Suggestions */}
      {suggestions && suggestions.suggested_times && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">✨</span>
            <h2 className="text-lg font-semibold text-gray-800">AI Scheduling Suggestions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suggestions.suggested_times.slice(0, 3).map((slot, i) => (
              <div key={i} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setNlpInput(`Book me on ${slot.date} at ${slot.time}`)}>
                <p className="font-medium text-gray-800">{slot.date}</p>
                <p className="text-lg text-blue-600">{slot.time}</p>
                <p className="text-sm text-gray-500 mt-1">{slot.reason}</p>
              </div>
            ))}
          </div>
          {suggestions.tips && suggestions.tips.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-gray-700 mb-2">Scheduling Tips:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.tips.map((tip, i) => (
                  <span key={i} className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{tip}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Feature Cards */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🧠</span>
          <h2 className="text-lg font-semibold text-gray-800">Advanced AI Features</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {aiFeatureCards.map((card) => (
            <div
              key={card.path}
              onClick={() => navigate(card.path)}
              className={`bg-gradient-to-br ${card.gradient} rounded-xl p-4 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-lg text-white`}
            >
              <span className="text-3xl mb-2 block">{card.icon}</span>
              <h3 className="font-semibold text-sm">{card.label}</h3>
              <p className="text-xs opacity-90 mt-1">{card.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {featureCards.map((card) => (
          <div
            key={card.path}
            onClick={() => navigate(card.path)}
            className="bg-white rounded-xl shadow-sm p-6 cursor-pointer card-hover border border-transparent hover:border-blue-200"
          >
            <div className={`inline-flex items-center justify-center w-12 h-12 ${card.color} rounded-lg mb-4`}>
              <span className="text-2xl">{card.icon}</span>
            </div>
            <h3 className="font-semibold text-gray-800">{card.label}</h3>
            <p className="text-sm text-gray-500 mt-1">{card.description}</p>
          </div>
        ))}
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Upcoming Appointments</h2>
          <button
            onClick={() => navigate('/appointments')}
            className="text-blue-600 hover:underline text-sm"
          >
            View All
          </button>
        </div>

        {upcomingAppointments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No upcoming appointments</p>
        ) : (
          <div className="space-y-3">
            {upcomingAppointments.map((apt) => (
              <div
                key={apt.id}
                onClick={() => navigate('/appointments')}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-800">{apt.title}</p>
                  <p className="text-sm text-gray-500">{apt.location || 'No location'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-blue-600">{formatDate(apt.start_time)}</p>
                  {apt.contact_name && (
                    <p className="text-sm text-gray-500">with {apt.contact_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Chat Assistant Button */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl z-40"
      >
        {showChat ? '✕' : '🤖'}
      </button>

      {/* AI Chat Panel */}
      {showChat && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="font-semibold">AI Assistant</h3>
                <p className="text-xs opacity-80">Ask me anything about scheduling</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <p className="text-4xl mb-2">👋</p>
                <p>Hi! I'm your AI scheduling assistant.</p>
                <p className="text-sm mt-2">Try asking:</p>
                <div className="mt-2 space-y-2">
                  {['What\'s my schedule today?', 'Schedule a meeting tomorrow', 'Give me productivity tips'].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setChatInput(q);
                      }}
                      className="block w-full text-sm bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="text-sm">{msg.content}</p>
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {msg.suggestions.map((s, j) => (
                        <p key={j} className="text-xs bg-white/20 px-2 py-1 rounded">{s}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 p-3 rounded-lg">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleChatSubmit} className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
