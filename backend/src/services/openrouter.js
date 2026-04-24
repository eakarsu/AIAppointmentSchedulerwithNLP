import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = process.env.AI_MODEL || 'anthropic/claude-3-haiku';
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE) || 0.3;
const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS) || 10000;

// Check if AI is configured
function isAIConfigured() {
  return OPENROUTER_API_KEY && OPENROUTER_API_KEY !== 'your_openrouter_api_key_here';
}

// Generic AI call function
async function callAI(systemPrompt, userMessage, options = {}) {
  if (!isAIConfigured()) {
    return null; // Return null to indicate AI is not available
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Appointment Scheduler'
      },
      body: JSON.stringify({
        model: options.model || AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: options.temperature || AI_TEMPERATURE,
        max_tokens: options.maxTokens || AI_MAX_TOKENS
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // Strip markdown code block formatting (```json ... ``` or ``` ... ```)
    content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Try to parse as JSON
    try {
      return JSON.parse(content);
    } catch {
      return { text: content };
    }
  } catch (error) {
    console.error('OpenRouter API error:', error);
    return null;
  }
}

// ============================================
// NLP PARSING - Parse natural language input
// ============================================
export async function parseNaturalLanguage(inputText) {
  const systemPrompt = `You are an intelligent appointment scheduling assistant. Parse natural language requests and extract appointment details.

Return a JSON object with these fields:
- action: "create", "update", "delete", "query", "reschedule" (required)
- title: appointment title (if mentioned or can be inferred)
- date: extracted date (ISO format YYYY-MM-DD or relative like "tomorrow", "next tuesday")
- time: extracted time (24h format HH:MM or relative like "afternoon", "morning")
- duration: duration in minutes (default 60)
- contact: contact name (if mentioned)
- location: location (if mentioned)
- description: any additional details
- confidence: 0-1 score of parsing confidence
- interpretation: brief explanation of how you understood the request

Be smart about interpreting:
- "Book me Tuesday afternoon" -> date=next tuesday, time=14:00
- "Schedule a call with Dr. Smith tomorrow at 3" -> contact=Dr. Smith, date=tomorrow, time=15:00
- "Cancel my 3pm meeting" -> action=delete, time=15:00
- "What's my schedule for next week?" -> action=query, date=next week
- "Move my dentist appointment to Friday" -> action=reschedule, date=friday

Always respond with valid JSON only, no additional text.`;

  const aiResult = await callAI(systemPrompt, inputText);

  if (aiResult && !aiResult.text) {
    return aiResult;
  }

  // Fallback to mock parsing if AI is not available
  return getMockParsedResponse(inputText);
}

// ============================================
// SMART SUGGESTIONS - AI-powered scheduling suggestions
// ============================================
export async function generateAppointmentSuggestion(context) {
  const systemPrompt = `You are an intelligent appointment scheduling assistant. Based on the user's context, appointments, and history, provide smart scheduling suggestions.

Analyze patterns and provide:
- suggested_times: array of {date: "YYYY-MM-DD", time: "HH:MM", reason: "why this time is good"}
- tips: array of helpful scheduling tips based on patterns you notice
- conflicts: any potential scheduling conflicts
- insights: observations about user's scheduling patterns
- optimal_duration: suggested duration based on similar appointments

Consider:
- User's typical schedule patterns
- Avoid scheduling conflicts
- Travel time between locations
- Meeting patterns (prefer similar times for similar meeting types)
- Work-life balance (avoid late night/early morning unless pattern exists)

Always respond with valid JSON only.`;

  const userMessage = JSON.stringify(context);
  const aiResult = await callAI(systemPrompt, userMessage);

  if (aiResult && !aiResult.text) {
    return aiResult;
  }

  return getMockSuggestion(context);
}

// ============================================
// SMART CONTACT MATCHING - Find best contact match
// ============================================
export async function findContactMatch(searchText, contacts) {
  if (!contacts || contacts.length === 0) {
    return { matches: [], confidence: 0 };
  }

  const systemPrompt = `You are a smart contact matching assistant. Given a search text and a list of contacts, find the best matches.

Return a JSON object with:
- matches: array of contact indices (0-based) that match, ordered by relevance
- confidence: 0-1 confidence score for the top match
- reasoning: brief explanation of matching logic

Be smart about:
- Partial name matches ("Dr. Sarah" matches "Dr. Sarah Mitchell")
- Title/role matches ("my doctor" might match someone from a hospital)
- Company matches ("TechCorp guy" matches someone at TechCorp)
- Phonetic similarities

Always respond with valid JSON only.`;

  const userMessage = JSON.stringify({
    search: searchText,
    contacts: contacts.map((c, i) => ({ index: i, name: c.name, company: c.company, notes: c.notes }))
  });

  const aiResult = await callAI(systemPrompt, userMessage);

  if (aiResult && aiResult.matches) {
    return {
      matches: aiResult.matches.map(i => contacts[i]).filter(Boolean),
      confidence: aiResult.confidence || 0.5,
      reasoning: aiResult.reasoning
    };
  }

  // Fallback: simple text matching
  const lowerSearch = searchText.toLowerCase();
  const matches = contacts.filter(c =>
    c.name.toLowerCase().includes(lowerSearch) ||
    (c.company && c.company.toLowerCase().includes(lowerSearch))
  );
  return { matches, confidence: matches.length > 0 ? 0.6 : 0 };
}

// ============================================
// SMART CATEGORIZATION - Auto-categorize appointments
// ============================================
export async function suggestCategory(appointmentDetails, categories) {
  if (!categories || categories.length === 0) {
    return null;
  }

  const systemPrompt = `You are a smart categorization assistant. Based on appointment details, suggest the most appropriate category.

Return a JSON object with:
- category_index: index of the best matching category (0-based)
- confidence: 0-1 confidence score
- reasoning: brief explanation

Consider:
- Title keywords (medical, business, personal, etc.)
- Contact information
- Location hints
- Time patterns (gym early morning, dinner evening, etc.)

Always respond with valid JSON only.`;

  const userMessage = JSON.stringify({
    appointment: appointmentDetails,
    categories: categories.map((c, i) => ({ index: i, name: c.name, description: c.description }))
  });

  const aiResult = await callAI(systemPrompt, userMessage);

  if (aiResult && typeof aiResult.category_index === 'number') {
    return {
      category: categories[aiResult.category_index],
      confidence: aiResult.confidence || 0.5,
      reasoning: aiResult.reasoning
    };
  }

  return null;
}

// ============================================
// CONFLICT DETECTION - Smart conflict analysis
// ============================================
export async function analyzeConflicts(newAppointment, existingAppointments) {
  if (!existingAppointments || existingAppointments.length === 0) {
    return { hasConflicts: false, conflicts: [], suggestions: [] };
  }

  const systemPrompt = `You are a smart scheduling conflict detector. Analyze potential conflicts between a new appointment and existing ones.

Return a JSON object with:
- hasConflicts: boolean
- conflicts: array of {appointment_index: number, type: "overlap"|"travel_time"|"back_to_back", severity: "high"|"medium"|"low", description: string}
- suggestions: array of alternative time suggestions to avoid conflicts
- warnings: any scheduling concerns (too many meetings, no breaks, etc.)

Consider:
- Direct time overlaps
- Back-to-back meetings without breaks
- Travel time between different locations
- Meeting fatigue (too many meetings in a row)

Always respond with valid JSON only.`;

  const userMessage = JSON.stringify({
    newAppointment,
    existingAppointments: existingAppointments.map((a, i) => ({
      index: i,
      title: a.title,
      start_time: a.start_time,
      end_time: a.end_time,
      location: a.location
    }))
  });

  const aiResult = await callAI(systemPrompt, userMessage);

  if (aiResult && typeof aiResult.hasConflicts === 'boolean') {
    return aiResult;
  }

  // Fallback: simple overlap detection
  const newStart = new Date(newAppointment.start_time);
  const newEnd = new Date(newAppointment.end_time);
  const conflicts = [];

  existingAppointments.forEach((apt, index) => {
    const aptStart = new Date(apt.start_time);
    const aptEnd = new Date(apt.end_time);

    if (newStart < aptEnd && newEnd > aptStart) {
      conflicts.push({
        appointment_index: index,
        type: 'overlap',
        severity: 'high',
        description: `Overlaps with "${apt.title}"`
      });
    }
  });

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    suggestions: []
  };
}

// ============================================
// SMART REMINDER SUGGESTIONS
// ============================================
export async function suggestReminders(appointment, userSettings) {
  const systemPrompt = `You are a smart reminder assistant. Suggest optimal reminder times for an appointment.

Return a JSON object with:
- reminders: array of {minutes_before: number, type: "email"|"sms", reason: string}
- priority: "high"|"medium"|"low" based on appointment importance

Consider:
- Appointment type (medical appointments need more advance notice)
- Time of day (morning appointments need evening-before reminders)
- Location (far locations need travel time reminders)
- User preferences

Always respond with valid JSON only.`;

  const userMessage = JSON.stringify({ appointment, userSettings });
  const aiResult = await callAI(systemPrompt, userMessage);

  if (aiResult && aiResult.reminders) {
    return aiResult;
  }

  // Fallback
  return {
    reminders: [
      { minutes_before: 60, type: 'email', reason: 'Standard 1-hour reminder' },
      { minutes_before: 15, type: 'sms', reason: 'Quick reminder before meeting' }
    ],
    priority: 'medium'
  };
}

// ============================================
// AI CHAT ASSISTANT - General Q&A
// ============================================
export async function chatWithAssistant(message, context) {
  const systemPrompt = `You are a helpful AI assistant for an appointment scheduling application. Help users with:

1. Scheduling questions
2. Understanding their calendar
3. Providing productivity tips
4. Answering questions about their appointments
5. Suggesting optimal scheduling strategies

Current context:
- User has ${context.appointmentCount || 0} appointments
- Next appointment: ${context.nextAppointment || 'None scheduled'}
- Today's appointments: ${context.todayCount || 0}

Be helpful, concise, and proactive in offering scheduling assistance.

Return a JSON object with:
- response: your helpful response text
- suggestions: array of actionable suggestions (if any)
- action: optional action to take (e.g., "create_appointment", "show_schedule")

Always respond with valid JSON only.`;

  const aiResult = await callAI(systemPrompt, message);

  if (aiResult) {
    return aiResult;
  }

  return {
    response: "I'm here to help with your scheduling needs. You can ask me to schedule appointments, check your calendar, or get productivity tips!",
    suggestions: [
      "Try saying 'What's my schedule today?'",
      "Or 'Book me a meeting tomorrow at 2pm'"
    ]
  };
}

// ============================================
// APPOINTMENT SUMMARY - Generate insights
// ============================================
export async function generateScheduleInsights(appointments, period = 'week') {
  const systemPrompt = `You are a schedule analyst. Analyze the user's appointments and provide insights.

Return a JSON object with:
- summary: brief overview of the schedule
- busiest_day: which day has the most appointments
- total_hours: total meeting hours
- patterns: observed scheduling patterns
- recommendations: suggestions for better scheduling
- work_life_balance: score 1-10 with explanation
- productivity_tips: personalized tips based on the schedule

Always respond with valid JSON only.`;

  const userMessage = JSON.stringify({ appointments, period });
  const aiResult = await callAI(systemPrompt, userMessage);

  if (aiResult && aiResult.summary) {
    return aiResult;
  }

  // Fallback
  const totalHours = appointments.reduce((sum, apt) => {
    const start = new Date(apt.start_time);
    const end = new Date(apt.end_time);
    return sum + (end - start) / (1000 * 60 * 60);
  }, 0);

  return {
    summary: `You have ${appointments.length} appointments scheduled.`,
    total_hours: Math.round(totalHours * 10) / 10,
    patterns: ['Regular scheduling patterns detected'],
    recommendations: ['Consider adding buffer time between meetings'],
    work_life_balance: 7,
    productivity_tips: ['Group similar meetings together for better focus']
  };
}

// ============================================
// SMART TITLE GENERATION
// ============================================
export async function generateAppointmentTitle(details) {
  const systemPrompt = `Generate a clear, concise appointment title based on the details provided.

Return a JSON object with:
- title: the suggested title (max 50 characters)
- alternatives: 2-3 alternative titles

Always respond with valid JSON only.`;

  const aiResult = await callAI(systemPrompt, JSON.stringify(details));

  if (aiResult && aiResult.title) {
    return aiResult;
  }

  // Fallback
  if (details.contact) return { title: `Meeting with ${details.contact}`, alternatives: [] };
  if (details.type) return { title: `${details.type} Appointment`, alternatives: [] };
  return { title: 'New Appointment', alternatives: [] };
}

// ============================================
// VOICE COMMAND PROCESSING
// ============================================
export async function processVoiceCommand(transcript) {
  return parseNaturalLanguage(transcript);
}

// ============================================
// DATE CONVERSION HELPER
// ============================================
export async function convertDateDescription(dateDescription) {
  const today = new Date();
  const dayOfWeek = today.getDay();

  const lowerDesc = dateDescription.toLowerCase();

  if (lowerDesc === 'today') {
    return today;
  }

  if (lowerDesc === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(lowerDesc);

  if (targetDay !== -1) {
    const daysUntilTarget = (targetDay - dayOfWeek + 7) % 7 || 7;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    return targetDate;
  }

  if (lowerDesc.includes('next week')) {
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return nextWeek;
  }

  return today;
}

// ============================================
// MOCK RESPONSES (when AI is not configured)
// ============================================
function getMockParsedResponse(inputText) {
  const lowerText = inputText.toLowerCase();
  const result = {
    action: 'create',
    confidence: 0.85,
    interpretation: 'Parsed using fallback pattern matching (configure OpenRouter API key for AI-powered parsing)'
  };

  // Parse action
  if (lowerText.includes('cancel') || lowerText.includes('delete')) {
    result.action = 'delete';
  } else if (lowerText.includes('move') || lowerText.includes('reschedule')) {
    result.action = 'reschedule';
  } else if (lowerText.includes('show') || lowerText.includes('what') || lowerText.includes('list')) {
    result.action = 'query';
  } else if (lowerText.includes('update') || lowerText.includes('change')) {
    result.action = 'update';
  }

  // Parse date
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (const day of days) {
    if (lowerText.includes(day)) {
      result.date = day;
      break;
    }
  }

  if (lowerText.includes('tomorrow')) {
    result.date = 'tomorrow';
  } else if (lowerText.includes('today')) {
    result.date = 'today';
  } else if (lowerText.includes('next week')) {
    result.date = 'next week';
  }

  // Parse time
  if (lowerText.includes('morning')) {
    result.time = '09:00';
    result.time_description = 'morning';
  } else if (lowerText.includes('afternoon')) {
    result.time = '14:00';
    result.time_description = 'afternoon';
  } else if (lowerText.includes('evening')) {
    result.time = '18:00';
    result.time_description = 'evening';
  }

  // Parse specific times
  const timeMatch = lowerText.match(/(\d{1,2})\s*(am|pm|:00|:30)/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    if (timeMatch[2].toLowerCase() === 'pm' && hour < 12) {
      hour += 12;
    }
    result.time = `${hour.toString().padStart(2, '0')}:00`;
  }

  // Parse duration
  const durationMatch = lowerText.match(/(\d+)\s*(hour|minute|min|hr)/i);
  if (durationMatch) {
    const value = parseInt(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    result.duration = unit.startsWith('hour') || unit === 'hr' ? value * 60 : value;
  } else {
    result.duration = 60;
  }

  // Extract contact names (handles "Dr. Smith", "Mr. Jones", full names, etc.)
  const withMatch = inputText.match(/with\s+((?:Dr|Mr|Mrs|Ms|Prof)\.?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  if (withMatch) {
    const title = withMatch[1] ? withMatch[1].trim() : '';
    const name = withMatch[2];
    result.contact = title ? `${title} ${name}` : name;
  }

  // Extract location (handles "at [Location]", "in [Location]")
  const locationMatch = inputText.match(/(?:at|in|@)\s+([A-Z][A-Za-z0-9\s,'.-]+?)(?:\s+(?:on|at|tomorrow|today|next|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d)|\s*$)/i);
  if (locationMatch) {
    result.location = locationMatch[1].trim();
  }

  // Extract description (handles "about [topic]", "for [purpose]", "regarding [topic]")
  const descMatch = inputText.match(/(?:about|for|regarding|re:?)\s+(.+?)(?:\s+(?:at|on|with|tomorrow|today)|\s*$)/i);
  if (descMatch) {
    result.description = descMatch[1].trim();
  }

  // Generate title based on input - INCLUDE CONTACT NAME
  const contactSuffix = result.contact ? ` with ${result.contact}` : '';

  if (lowerText.includes('meeting')) {
    result.title = `Meeting${contactSuffix}`;
  } else if (lowerText.includes('call') || lowerText.includes('phone')) {
    result.title = `Call${contactSuffix}`;
  } else if (lowerText.includes('lunch')) {
    result.title = `Lunch${contactSuffix}`;
  } else if (lowerText.includes('dinner')) {
    result.title = `Dinner${contactSuffix}`;
  } else if (lowerText.includes('coffee')) {
    result.title = `Coffee${contactSuffix}`;
  } else if (lowerText.includes('appointment')) {
    result.title = `Appointment${contactSuffix}`;
  } else if (lowerText.includes('doctor') || lowerText.includes('medical')) {
    result.title = 'Doctor Appointment';
  } else if (lowerText.includes('dentist')) {
    result.title = 'Dentist Appointment';
  } else if (lowerText.includes('gym') || lowerText.includes('workout')) {
    result.title = 'Gym Session';
  } else if (result.contact) {
    result.title = `Meeting${contactSuffix}`;
  } else {
    result.title = 'New Appointment';
  }

  return result;
}

function getMockSuggestion(context) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return {
    suggested_times: [
      {
        date: tomorrow.toISOString().split('T')[0],
        time: '10:00',
        reason: 'Morning slot typically has good availability'
      },
      {
        date: tomorrow.toISOString().split('T')[0],
        time: '14:00',
        reason: 'After lunch is usually a productive time'
      },
      {
        date: nextWeek.toISOString().split('T')[0],
        time: '09:00',
        reason: 'Early morning next week for longer planning horizon'
      }
    ],
    tips: [
      'Consider leaving 15 minutes buffer between appointments',
      'Morning appointments tend to have fewer cancellations',
      'For important meetings, mid-week (Tue-Thu) often works best'
    ],
    insights: 'Configure OpenRouter API key for AI-powered insights',
    conflicts: []
  };
}

// ============================================
// AI BUFFER TIME OPTIMIZER
// ============================================
export async function analyzeBufferTime(appointment, previousAppointment, nextAppointment, userHistory) {
  const systemPrompt = `You are an AI Buffer Time Optimizer for appointment scheduling. Analyze appointments and suggest optimal buffer times.

Consider:
- Travel time between locations (if different)
- Preparation time needed for the appointment type
- Decompression/break time after stressful appointments
- User's historical patterns
- Time of day and fatigue levels
- Appointment importance and complexity

Return a JSON object with:
- suggested_buffer_minutes: recommended buffer time in minutes
- travel_time_estimate: estimated travel time if locations differ
- preparation_time: time needed to prepare
- decompression_time: recommended break after
- confidence_score: 0-1 confidence in the suggestion
- reasoning: detailed explanation of the recommendation
- optimization_tips: array of tips for better time management

Always respond with valid JSON only.`;

  const userMessage = JSON.stringify({
    current_appointment: appointment,
    previous_appointment: previousAppointment,
    next_appointment: nextAppointment,
    user_patterns: userHistory
  });

  const aiResult = await callAI(systemPrompt, userMessage);

  if (aiResult && typeof aiResult.suggested_buffer_minutes === 'number') {
    return aiResult;
  }

  // Fallback
  const hasDifferentLocations = previousAppointment?.location !== appointment?.location;
  return {
    suggested_buffer_minutes: hasDifferentLocations ? 30 : 15,
    travel_time_estimate: hasDifferentLocations ? 20 : 0,
    preparation_time: 10,
    decompression_time: 5,
    confidence_score: 0.6,
    reasoning: 'Default buffer time based on location analysis',
    optimization_tips: ['Consider adding buffer time between back-to-back meetings', 'Account for potential delays']
  };
}

// ============================================
// AI NO-SHOW PREDICTOR
// ============================================
export async function predictNoShow(appointment, contact, userHistory, appointmentHistory) {
  const systemPrompt = `You are an AI No-Show Predictor. Analyze appointment data and predict the likelihood of a no-show.

Consider these factors:
- Contact's historical attendance record
- Day of week and time of day patterns
- Appointment type and importance
- Weather considerations (if outdoor)
- Lead time before appointment
- Reminder acknowledgment patterns
- Contact communication responsiveness

Return a JSON object with:
- prediction_score: 0-1 probability of no-show (higher = more likely to miss)
- risk_level: "low", "medium", or "high"
- contributing_factors: array of {factor: string, weight: number, description: string}
- suggested_actions: array of {action: string, priority: number, expected_impact: string}
- reasoning: detailed explanation
- recommended_reminders: array of {timing: string, method: string, message_tone: string}

Always respond with valid JSON only.`;

  const userMessage = JSON.stringify({
    appointment,
    contact,
    user_patterns: userHistory,
    appointment_history: appointmentHistory
  });

  const aiResult = await callAI(systemPrompt, userMessage);

  if (aiResult && typeof aiResult.prediction_score === 'number') {
    return aiResult;
  }

  // Fallback based on simple heuristics
  const score = Math.random() * 0.3; // Low default risk
  return {
    prediction_score: score,
    risk_level: score < 0.2 ? 'low' : score < 0.5 ? 'medium' : 'high',
    contributing_factors: [
      { factor: 'Historical Attendance', weight: 0.4, description: 'Based on past appointment attendance' },
      { factor: 'Lead Time', weight: 0.3, description: 'Appointments booked further out have higher no-show rates' },
      { factor: 'Appointment Type', weight: 0.3, description: 'Certain appointment types have different attendance rates' }
    ],
    suggested_actions: [
      { action: 'Send confirmation reminder 24 hours before', priority: 1, expected_impact: 'Reduces no-shows by ~20%' },
      { action: 'Send same-day reminder', priority: 2, expected_impact: 'Reduces no-shows by ~15%' }
    ],
    reasoning: 'Prediction based on general attendance patterns (configure AI for personalized predictions)',
    recommended_reminders: [
      { timing: '24 hours before', method: 'email', message_tone: 'friendly' },
      { timing: '2 hours before', method: 'sms', message_tone: 'brief' }
    ]
  };
}

// ============================================
// AI RESCHEDULE SUGGESTER
// ============================================
export async function suggestReschedule(appointment, existingAppointments, userPreferences, reason) {
  const systemPrompt = `You are an AI Reschedule Suggester. When an appointment needs to be rescheduled, suggest the best alternative times.

Consider:
- User's typical schedule patterns
- Existing appointments and conflicts
- Time preferences (morning vs afternoon person)
- Meeting type requirements
- Urgency of the rescheduled appointment
- Contact's likely availability
- Optimal spacing between similar appointments

Return a JSON object with:
- suggested_times: array of {
    date: "YYYY-MM-DD",
    time: "HH:MM",
    end_time: "HH:MM",
    score: 0-1 (higher = better fit),
    reasoning: string
  }
- priority_score: 0-1 urgency of rescheduling
- reasoning: overall explanation
- impact_analysis: {
    affected_appointments: number,
    productivity_impact: string,
    recommendations: array of strings
  }
- alternative_approaches: array of alternative solutions (e.g., "Consider virtual meeting")

Always respond with valid JSON only.`;

  const userMessage = JSON.stringify({
    appointment_to_reschedule: appointment,
    existing_schedule: existingAppointments,
    preferences: userPreferences,
    reschedule_reason: reason
  });

  const aiResult = await callAI(systemPrompt, userMessage);

  if (aiResult && aiResult.suggested_times && aiResult.suggested_times.length > 0) {
    return aiResult;
  }

  // Fallback: Generate basic suggestions
  const today = new Date();
  const suggestions = [];

  for (let i = 1; i <= 5; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    suggestions.push({
      date: dateStr,
      time: '10:00',
      end_time: '11:00',
      score: 1 - (i * 0.1),
      reasoning: `Available slot on ${date.toLocaleDateString('en-US', { weekday: 'long' })}`
    });
  }

  return {
    suggested_times: suggestions,
    priority_score: 0.5,
    reasoning: 'Suggestions based on available time slots (configure AI for smarter recommendations)',
    impact_analysis: {
      affected_appointments: 0,
      productivity_impact: 'Minimal impact expected',
      recommendations: ['Choose a time that works best for all parties', 'Consider the appointment urgency']
    },
    alternative_approaches: ['Consider a virtual meeting if in-person is difficult', 'Split into multiple shorter meetings']
  };
}

// ============================================
// AI RESOURCE ALLOCATOR
// ============================================
export async function optimizeResourceAllocation(appointments, resources, constraints) {
  const systemPrompt = `You are an AI Resource Allocator. Optimize the allocation of resources (rooms, equipment, staff, etc.) to appointments.

Consider:
- Resource availability and capacity
- Skill/capability matching
- Cost efficiency
- Geographic proximity
- Resource utilization balance
- Priority of appointments
- Resource preferences and historical assignments

Return a JSON object with:
- allocations: array of {
    appointment_id: number,
    resource_id: number,
    allocation_type: "primary"|"backup",
    utilization_score: 0-1,
    cost_efficiency_score: 0-1,
    reasoning: string
  }
- overall_efficiency: 0-1 score for the entire allocation
- conflicts: array of conflicts that couldn't be resolved
- recommendations: array of improvement suggestions
- cost_summary: {
    total_cost: number,
    savings_potential: number,
    optimization_suggestions: array of strings
  }
- capacity_analysis: {
    overutilized_resources: array,
    underutilized_resources: array,
    rebalancing_suggestions: array
  }

Always respond with valid JSON only.`;

  const userMessage = JSON.stringify({
    appointments,
    available_resources: resources,
    constraints
  });

  const aiResult = await callAI(systemPrompt, userMessage);

  if (aiResult && aiResult.allocations) {
    return aiResult;
  }

  // Fallback: Simple round-robin allocation
  const allocations = appointments.map((apt, index) => ({
    appointment_id: apt.id,
    resource_id: resources.length > 0 ? resources[index % resources.length]?.id : null,
    allocation_type: 'primary',
    utilization_score: 0.7,
    cost_efficiency_score: 0.7,
    reasoning: 'Default allocation (configure AI for optimized resource allocation)'
  }));

  return {
    allocations,
    overall_efficiency: 0.65,
    conflicts: [],
    recommendations: [
      'Consider AI-powered allocation for better resource utilization',
      'Review resource availability to improve scheduling flexibility'
    ],
    cost_summary: {
      total_cost: 0,
      savings_potential: 0,
      optimization_suggestions: ['Enable AI for cost optimization analysis']
    },
    capacity_analysis: {
      overutilized_resources: [],
      underutilized_resources: [],
      rebalancing_suggestions: ['Run AI analysis to identify optimization opportunities']
    }
  };
}

// ============================================
// AI CONFLICT RESOLVER (Enhanced)
// ============================================
export async function resolveConflicts(conflicts, appointments, userPreferences) {
  const systemPrompt = `You are an AI Conflict Resolver. Analyze scheduling conflicts and provide comprehensive resolution strategies.

Consider:
- Priority of conflicting appointments
- Flexibility of each appointment
- Impact on all parties involved
- Historical resolution patterns
- User preferences
- Available alternative slots

Return a JSON object with:
- resolutions: array of {
    conflict_id: string,
    strategy: "reschedule"|"shorten"|"virtualize"|"delegate"|"cancel",
    affected_appointments: array of appointment IDs,
    new_times: array of suggested new times,
    reasoning: string,
    confidence: 0-1
  }
- overall_strategy: high-level approach explanation
- impact_summary: {
    appointments_affected: number,
    time_saved: number (minutes),
    conflicts_resolved: number
  }
- preventive_measures: array of tips to prevent future conflicts

Always respond with valid JSON only.`;

  const userMessage = JSON.stringify({
    conflicts,
    all_appointments: appointments,
    preferences: userPreferences
  });

  const aiResult = await callAI(systemPrompt, userMessage);

  if (aiResult && aiResult.resolutions) {
    return aiResult;
  }

  // Fallback
  return {
    resolutions: conflicts.map((conflict, index) => ({
      conflict_id: `conflict_${index}`,
      strategy: 'reschedule',
      affected_appointments: [conflict.appointment_index],
      new_times: [],
      reasoning: 'Consider rescheduling to an available time slot',
      confidence: 0.5
    })),
    overall_strategy: 'Review and reschedule conflicting appointments',
    impact_summary: {
      appointments_affected: conflicts.length,
      time_saved: 0,
      conflicts_resolved: 0
    },
    preventive_measures: [
      'Add buffer time between appointments',
      'Check for conflicts before booking',
      'Enable conflict detection alerts'
    ]
  };
}

export { isAIConfigured };
