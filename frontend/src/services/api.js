const API_BASE = '/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
}

// Normalize paginated responses: supports both legacy {data, total, page, totalPages}
// and new {data, pagination:{page, limit, total, totalPages}} shapes.
export function normalizePaginated(res) {
  if (!res) return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  if (res.pagination) return res;
  // Legacy shape
  return {
    data: res.data || [],
    pagination: {
      page: res.page || 1,
      limit: res.limit || 20,
      total: res.total || 0,
      totalPages: res.totalPages || 0,
    },
  };
}

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', params.page);
  if (params.limit) q.set('limit', params.limit);
  if (params.search) q.set('search', params.search);
  if (params.sort) q.set('sort', params.sort);
  if (params.order) q.set('order', params.order);
  const str = q.toString();
  return str ? `?${str}` : '';
}

// Auth
export const authApi = {
  getDemoCredentials: () =>
    fetch(`${API_BASE}/auth/demo-credentials`).then(handleResponse),
  login: (email, password) =>
    fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(handleResponse),
  register: (name, email, password) =>
    fetch(`${API_BASE}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) }).then(handleResponse),
  forgotPassword: (email) =>
    fetch(`${API_BASE}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).then(handleResponse),
  resetPassword: (token, password) =>
    fetch(`${API_BASE}/auth/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) }).then(handleResponse),
  changePassword: (currentPassword, newPassword) =>
    fetch(`${API_BASE}/auth/change-password`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ currentPassword, newPassword }) }).then(handleResponse),
  logout: () =>
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: getHeaders() }).then(handleResponse)
};

// Appointments
export const appointmentsApi = {
  getAll: (params) =>
    fetch(`${API_BASE}/appointments${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),
  getById: (id) =>
    fetch(`${API_BASE}/appointments/${id}`, { headers: getHeaders() }).then(handleResponse),
  getUpcoming: () =>
    fetch(`${API_BASE}/appointments/upcoming`, { headers: getHeaders() }).then(handleResponse),
  create: (data) =>
    fetch(`${API_BASE}/appointments`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  createFromNlp: (input) =>
    fetch(`${API_BASE}/appointments/nlp`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ input }) }).then(handleResponse),
  update: (id, data) =>
    fetch(`${API_BASE}/appointments/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  delete: (id) =>
    fetch(`${API_BASE}/appointments/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),
  bulkDelete: (ids) =>
    fetch(`${API_BASE}/appointments/bulk-delete`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ ids }) }).then(handleResponse),
  bulkUpdate: (ids, status) =>
    fetch(`${API_BASE}/appointments/bulk-update`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ ids, status }) }).then(handleResponse)
};

// Contacts
export const contactsApi = {
  getAll: (params) =>
    fetch(`${API_BASE}/contacts${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),
  getById: (id) =>
    fetch(`${API_BASE}/contacts/${id}`, { headers: getHeaders() }).then(handleResponse),
  create: (data) =>
    fetch(`${API_BASE}/contacts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  update: (id, data) =>
    fetch(`${API_BASE}/contacts/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  delete: (id) =>
    fetch(`${API_BASE}/contacts/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),
  bulkDelete: (ids) =>
    fetch(`${API_BASE}/contacts/bulk-delete`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ ids }) }).then(handleResponse)
};

// Categories
export const categoriesApi = {
  getAll: (params) =>
    fetch(`${API_BASE}/categories${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),
  getById: (id) =>
    fetch(`${API_BASE}/categories/${id}`, { headers: getHeaders() }).then(handleResponse),
  create: (data) =>
    fetch(`${API_BASE}/categories`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  update: (id, data) =>
    fetch(`${API_BASE}/categories/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  delete: (id) =>
    fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),
  bulkDelete: (ids) =>
    fetch(`${API_BASE}/categories/bulk-delete`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ ids }) }).then(handleResponse)
};

// Reminders
export const remindersApi = {
  getAll: (params) =>
    fetch(`${API_BASE}/reminders${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),
  getById: (id) =>
    fetch(`${API_BASE}/reminders/${id}`, { headers: getHeaders() }).then(handleResponse),
  create: (data) =>
    fetch(`${API_BASE}/reminders`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  update: (id, data) =>
    fetch(`${API_BASE}/reminders/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  delete: (id) =>
    fetch(`${API_BASE}/reminders/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),
  bulkDelete: (ids) =>
    fetch(`${API_BASE}/reminders/bulk-delete`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ ids }) }).then(handleResponse)
};

// AI / NLP
export const aiApi = {
  getStatus: () =>
    fetch(`${API_BASE}/nlp/status`, { headers: getHeaders() }).then(handleResponse),
  parse: (text) =>
    fetch(`${API_BASE}/nlp/parse`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ text }) }).then(handleResponse),
  getSuggestions: (request, preferences) =>
    fetch(`${API_BASE}/nlp/suggestions`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ request, preferences }) }).then(handleResponse),
  chat: (message) =>
    fetch(`${API_BASE}/nlp/chat`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ message }) }).then(handleResponse),
  getInsights: (period = 'week') =>
    fetch(`${API_BASE}/nlp/insights?period=${period}`, { headers: getHeaders() }).then(handleResponse),
  matchContact: (search) =>
    fetch(`${API_BASE}/nlp/match-contact`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ search }) }).then(handleResponse),
  suggestCategory: (appointment) =>
    fetch(`${API_BASE}/nlp/suggest-category`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ appointment }) }).then(handleResponse),
  checkConflicts: (appointment) =>
    fetch(`${API_BASE}/nlp/check-conflicts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ appointment }) }).then(handleResponse),
  suggestReminders: (appointment) =>
    fetch(`${API_BASE}/nlp/suggest-reminders`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ appointment }) }).then(handleResponse),
  generateTitle: (details) =>
    fetch(`${API_BASE}/nlp/generate-title`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ details }) }).then(handleResponse),
  getLogs: (params) =>
    fetch(`${API_BASE}/nlp/logs${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),
  getLogById: (id) =>
    fetch(`${API_BASE}/nlp/logs/${id}`, { headers: getHeaders() }).then(handleResponse),
  deleteLog: (id) =>
    fetch(`${API_BASE}/nlp/logs/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse)
};

export const nlpApi = aiApi;

// Voice Commands
export const voiceApi = {
  getAll: (params) =>
    fetch(`${API_BASE}/voice${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),
  getById: (id) =>
    fetch(`${API_BASE}/voice/${id}`, { headers: getHeaders() }).then(handleResponse),
  process: (transcript) =>
    fetch(`${API_BASE}/voice/process`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ transcript }) }).then(handleResponse),
  delete: (id) =>
    fetch(`${API_BASE}/voice/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse)
};

// Settings
export const settingsApi = {
  get: () =>
    fetch(`${API_BASE}/settings`, { headers: getHeaders() }).then(handleResponse),
  update: (data) =>
    fetch(`${API_BASE}/settings`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse)
};

// Advanced AI Features
export const advancedAiApi = {
  getSummary: () =>
    fetch(`${API_BASE}/ai/summary`, { headers: getHeaders() }).then(handleResponse),
  getBufferAnalyses: (params) =>
    fetch(`${API_BASE}/ai/buffer${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),
  analyzeBuffer: (appointment_id) =>
    fetch(`${API_BASE}/ai/buffer/analyze`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ appointment_id }) }).then(handleResponse),
  applyBufferSuggestion: (id) =>
    fetch(`${API_BASE}/ai/buffer/${id}/apply`, { method: 'PUT', headers: getHeaders() }).then(handleResponse),
  deleteBufferAnalysis: (id) =>
    fetch(`${API_BASE}/ai/buffer/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),
  getNoShowPredictions: (params) =>
    fetch(`${API_BASE}/ai/noshow${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),
  predictNoShow: (appointment_id) =>
    fetch(`${API_BASE}/ai/noshow/predict`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ appointment_id }) }).then(handleResponse),
  updateNoShowOutcome: (id, actual_outcome) =>
    fetch(`${API_BASE}/ai/noshow/${id}/outcome`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ actual_outcome }) }).then(handleResponse),
  deleteNoShowPrediction: (id) =>
    fetch(`${API_BASE}/ai/noshow/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),
  getRescheduleSuggestions: (params) =>
    fetch(`${API_BASE}/ai/reschedule${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),
  suggestReschedule: (appointment_id, reason) =>
    fetch(`${API_BASE}/ai/reschedule/suggest`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ appointment_id, reason }) }).then(handleResponse),
  acceptRescheduleSuggestion: (id, suggestion_index) =>
    fetch(`${API_BASE}/ai/reschedule/${id}/accept`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ suggestion_index }) }).then(handleResponse),
  deleteRescheduleSuggestion: (id) =>
    fetch(`${API_BASE}/ai/reschedule/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),
  getResources: (params) =>
    fetch(`${API_BASE}/ai/resources${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),
  createResource: (data) =>
    fetch(`${API_BASE}/ai/resources`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  updateResource: (id, data) =>
    fetch(`${API_BASE}/ai/resources/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  deleteResource: (id) =>
    fetch(`${API_BASE}/ai/resources/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),
  getAllocations: (params) =>
    fetch(`${API_BASE}/ai/allocations${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),
  optimizeAllocations: (appointment_ids, constraints) =>
    fetch(`${API_BASE}/ai/allocations/optimize`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ appointment_ids, constraints }) }).then(handleResponse),
  deleteAllocation: (id) =>
    fetch(`${API_BASE}/ai/allocations/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),
  resolveConflicts: (conflicts) =>
    fetch(`${API_BASE}/ai/conflicts/resolve`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ conflicts }) }).then(handleResponse)
};

// Unified Search
export const searchApi = {
  search: (q) =>
    fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`, { headers: getHeaders() }).then(handleResponse),
};

// Advanced AI — additional new features
export const aiNewApi = {
  // Follow-up generator
  generateFollowUp: (appointmentId) =>
    fetch(`${API_BASE}/ai/followup/${appointmentId}`, { method: 'POST', headers: getHeaders(), body: '{}' }).then(handleResponse),
  listFollowUps: (params) =>
    fetch(`${API_BASE}/ai/followup${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),

  // AI appointment scoring
  scoreAppointment: (appointmentId) =>
    fetch(`${API_BASE}/ai/score/${appointmentId}`, { method: 'POST', headers: getHeaders(), body: '{}' }).then(handleResponse),

  // Conflict resolutions history
  getConflictResolutions: (params) =>
    fetch(`${API_BASE}/ai/conflicts${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),

  // Contact relationship intelligence
  getOverdueContacts: (days = 30) =>
    fetch(`${API_BASE}/contacts/overdue?days=${days}`, { headers: getHeaders() }).then(handleResponse),

  // NLP log bulk delete
  bulkDeleteNlpLogs: (ids) =>
    fetch(`${API_BASE}/nlp/logs/bulk-delete`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ ids }) }).then(handleResponse),
};

// AI Extras (NEW audit-proposed features)
export const aiExtrasApi = {
  // 1. Time-zone Smart Rescheduling
  tzReschedule: (payload) =>
    fetch(`${API_BASE}/ai-extras/tz-reschedule`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }).then(handleResponse),

  // 2. Meeting Duration Predictor
  durationPredict: (payload) =>
    fetch(`${API_BASE}/ai-extras/duration-predict`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }).then(handleResponse),
  listDurationPredictions: (params) =>
    fetch(`${API_BASE}/ai-extras/duration-predict${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),

  // 3. Calendar Heatmap
  heatmap: () =>
    fetch(`${API_BASE}/ai-extras/heatmap`, { headers: getHeaders() }).then(handleResponse),

  // 4. Meeting Transcript Summarizer
  summarize: (payload) =>
    fetch(`${API_BASE}/ai-extras/summarize`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }).then(handleResponse),
  listTranscripts: (params) =>
    fetch(`${API_BASE}/ai-extras/summarize${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),

  // 5. Attendee Sentiment Checker
  sentiment: (payload) =>
    fetch(`${API_BASE}/ai-extras/sentiment`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }).then(handleResponse),
  listFeedback: (params) =>
    fetch(`${API_BASE}/ai-extras/sentiment${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),

  // 6. Smart Recurring Pattern detection
  recurringPatterns: () =>
    fetch(`${API_BASE}/ai-extras/recurring-patterns`, { method: 'POST', headers: getHeaders(), body: '{}' }).then(handleResponse),

  // 7. Meeting Value ROI
  meetingROI: (payload) =>
    fetch(`${API_BASE}/ai-extras/roi`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }).then(handleResponse),
  listROI: (params) =>
    fetch(`${API_BASE}/ai-extras/roi${buildQuery(params)}`, { headers: getHeaders() }).then(handleResponse),

  // 8. Cross-Team Calendar Consensus
  teamConsensus: (payload) =>
    fetch(`${API_BASE}/ai-extras/team-consensus`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }).then(handleResponse),

  // Apply pass 5 backlog
  cancellationPredict: (payload) =>
    fetch(`${API_BASE}/ai-extras/cancellation-predict`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }).then(handleResponse),
  satisfactionScore: (payload) =>
    fetch(`${API_BASE}/ai-extras/satisfaction-score`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }).then(handleResponse),
  optimalTimeSuggest: (payload) =>
    fetch(`${API_BASE}/ai-extras/optimal-time-suggest`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }).then(handleResponse),
};
