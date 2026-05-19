import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Contacts from './pages/Contacts';
import Categories from './pages/Categories';
import Reminders from './pages/Reminders';
import NlpLogs from './pages/NlpLogs';
import VoiceCommands from './pages/VoiceCommands';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import BufferOptimizer from './pages/BufferOptimizer';
import NoShowPredictor from './pages/NoShowPredictor';
import RescheduleSuggester from './pages/RescheduleSuggester';
import ResourceAllocator from './pages/ResourceAllocator';
import ConflictResolver from './pages/ConflictResolver';
import AIExtras from './pages/AIExtras';
import Search from './pages/Search';
import CustomViewsPage from './pages/CustomViewsPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                  <Route path="/appointments" element={<ErrorBoundary><Appointments /></ErrorBoundary>} />
                  <Route path="/contacts" element={<ErrorBoundary><Contacts /></ErrorBoundary>} />
                  <Route path="/categories" element={<ErrorBoundary><Categories /></ErrorBoundary>} />
                  <Route path="/reminders" element={<ErrorBoundary><Reminders /></ErrorBoundary>} />
                  <Route path="/nlp-logs" element={<ErrorBoundary><NlpLogs /></ErrorBoundary>} />
                  <Route path="/voice-commands" element={<ErrorBoundary><VoiceCommands /></ErrorBoundary>} />
                  <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
                  <Route path="/ai/buffer-optimizer" element={<ErrorBoundary><BufferOptimizer /></ErrorBoundary>} />
                  <Route path="/ai/noshow-predictor" element={<ErrorBoundary><NoShowPredictor /></ErrorBoundary>} />
                  <Route path="/ai/reschedule-suggester" element={<ErrorBoundary><RescheduleSuggester /></ErrorBoundary>} />
                  <Route path="/ai/resource-allocator" element={<ErrorBoundary><ResourceAllocator /></ErrorBoundary>} />
                  <Route path="/ai/conflict-resolver" element={<ErrorBoundary><ConflictResolver /></ErrorBoundary>} />
                  <Route path="/ai/extras" element={<ErrorBoundary><AIExtras /></ErrorBoundary>} />
                  <Route path="/search" element={<ErrorBoundary><Search /></ErrorBoundary>} />
                  <Route path="/custom-views" element={<ErrorBoundary><CustomViewsPage /></ErrorBoundary>} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
