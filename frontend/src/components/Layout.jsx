import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/search', label: 'Search', icon: '🔍' },
  { path: '/appointments', label: 'Appointments', icon: '📅' },
  { path: '/contacts', label: 'Contacts', icon: '👥' },
  { path: '/categories', label: 'Categories', icon: '🏷️' },
  { path: '/reminders', label: 'Reminders', icon: '🔔' },
  { path: '/nlp-logs', label: 'NLP Logs', icon: '🤖' },
  { path: '/voice-commands', label: 'Voice Commands', icon: '🎤' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
  { path: '/custom-views', label: 'Scheduler Views', icon: '🗓️' }
];

const aiNavItems = [
  { path: '/ai/buffer-optimizer', label: 'Buffer Optimizer', icon: '🕐' },
  { path: '/ai/noshow-predictor', label: 'No-Show Predictor', icon: '📊' },
  { path: '/ai/reschedule-suggester', label: 'Reschedule Suggester', icon: '📅' },
  { path: '/ai/resource-allocator', label: 'Resource Allocator', icon: '⚡' },
  { path: '/ai/conflict-resolver', label: 'Conflict Resolver', icon: '🔀' },
  { path: '/ai/extras', label: 'AI Extras', icon: '✨' }
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white shadow-sm z-20 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="font-semibold text-gray-800">AI Scheduler</span>
        <div className="w-10"></div>
      </div>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-40 transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-blue-600">AI Appointment</h1>
          <p className="text-sm text-gray-500">Scheduler</p>
        </div>

        <nav className="p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors
                    ${location.pathname === item.path
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* AI Features Section */}
          <div className="mt-6 pt-4 border-t">
            <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              AI Features
            </p>
            <ul className="space-y-1">
              {aiNavItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors
                      ${location.pathname === item.path
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">{user?.name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
