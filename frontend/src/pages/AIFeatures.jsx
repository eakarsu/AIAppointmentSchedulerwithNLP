import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { advancedAiApi } from '../services/api';

const aiFeatureCards = [
  {
    path: '/ai/buffer-optimizer',
    label: 'Buffer Time Optimizer',
    icon: '🕐',
    color: 'bg-cyan-500',
    gradient: 'from-cyan-500 to-blue-600',
    description: 'Analyze and optimize buffer times between appointments'
  },
  {
    path: '/ai/noshow-predictor',
    label: 'No-Show Predictor',
    icon: '📊',
    color: 'bg-orange-500',
    gradient: 'from-orange-500 to-red-600',
    description: 'Predict appointment no-shows and take preventive action'
  },
  {
    path: '/ai/reschedule-suggester',
    label: 'Reschedule Suggester',
    icon: '📅',
    color: 'bg-purple-500',
    gradient: 'from-purple-500 to-pink-600',
    description: 'Get AI-powered suggestions for rescheduling appointments'
  },
  {
    path: '/ai/resource-allocator',
    label: 'Resource Allocator',
    icon: '⚡',
    color: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-teal-600',
    description: 'Optimize resource allocation for better efficiency'
  }
];

export default function AIFeatures() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const data = await advancedAiApi.getSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load AI summary:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-4xl">🧠</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold">AI-Powered Features</h1>
            <p className="opacity-90">Advanced scheduling intelligence at your fingertips</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <span className={`w-3 h-3 rounded-full ${summary?.ai_configured ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></span>
          <span className="text-sm">
            AI Engine: {summary?.ai_configured ? 'Fully Active (OpenRouter)' : 'Running in Limited Mode'}
          </span>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {aiFeatureCards.map((card) => {
          const featureKey = card.path.split('/').pop().replace('-', '_');
          const featureData = summary?.features?.[featureKey === 'buffer-optimizer' ? 'buffer_time_optimizer' :
            featureKey === 'noshow-predictor' ? 'no_show_predictor' :
            featureKey === 'reschedule-suggester' ? 'reschedule_suggester' : 'resource_allocator'];

          return (
            <div
              key={card.path}
              onClick={() => navigate(card.path)}
              className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
            >
              <div className={`bg-gradient-to-r ${card.gradient} p-6 text-white`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                    <span className="text-3xl">{card.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{card.label}</h3>
                    <p className="text-sm opacity-90">{card.description}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white">
                {featureData && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {featureData.analyses_count !== undefined && `${featureData.analyses_count} analyses`}
                      {featureData.predictions_count !== undefined && `${featureData.predictions_count} predictions`}
                      {featureData.suggestions_count !== undefined && `${featureData.suggestions_count} suggestions`}
                      {featureData.resources_count !== undefined && `${featureData.resources_count} resources`}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${featureData.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {featureData.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                )}
                <div className="mt-3 flex items-center text-indigo-600 font-medium">
                  <span>Open Feature</span>
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Capabilities Info */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">How AI Powers Your Scheduling</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg">
            <div className="text-2xl mb-2">🕐</div>
            <h3 className="font-semibold text-gray-800">Smart Buffer Times</h3>
            <p className="text-sm text-gray-600 mt-1">
              AI analyzes travel time, preparation needs, and your patterns to suggest optimal breaks between appointments.
            </p>
          </div>
          <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-semibold text-gray-800">Predictive Analytics</h3>
            <p className="text-sm text-gray-600 mt-1">
              Machine learning identifies patterns in attendance data to predict and prevent no-shows.
            </p>
          </div>
          <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
            <div className="text-2xl mb-2">📅</div>
            <h3 className="font-semibold text-gray-800">Intelligent Rescheduling</h3>
            <p className="text-sm text-gray-600 mt-1">
              When appointments need to move, AI finds the best alternative times considering all constraints.
            </p>
          </div>
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg">
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="font-semibold text-gray-800">Resource Optimization</h3>
            <p className="text-sm text-gray-600 mt-1">
              Automatically allocate rooms, equipment, and staff for maximum efficiency and cost savings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
