import pool from '../config/database.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';
import {
  analyzeBufferTime,
  predictNoShow,
  suggestReschedule,
  optimizeResourceAllocation,
  resolveConflicts,
  isAIConfigured
} from '../services/openrouter.js';

// ============================================
// AI BUFFER TIME OPTIMIZER
// ============================================

export async function getAllBufferAnalyses(req, res) {
  try {
    const { page, limit, offset, search } = getPaginationParams(req.query);
    let whereClause = 'WHERE bta.user_id = $1';
    const params = [req.user.id];
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (a.title ILIKE $${params.length} OR a.location ILIKE $${params.length})`;
    }
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM buffer_time_analyses bta LEFT JOIN appointments a ON bta.appointment_id = a.id ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(
      `SELECT bta.*, a.title as appointment_title, a.start_time, a.location
       FROM buffer_time_analyses bta LEFT JOIN appointments a ON bta.appointment_id = a.id
       ${whereClause} ORDER BY bta.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get buffer analyses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function analyzeAppointmentBuffer(req, res) {
  const { appointment_id } = req.body;
  try {
    const aptResult = await pool.query('SELECT * FROM appointments WHERE id = $1 AND user_id = $2', [appointment_id, req.user.id]);
    if (aptResult.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    const appointment = aptResult.rows[0];
    const [prevResult, nextResult, historyResult] = await Promise.all([
      pool.query(`SELECT * FROM appointments WHERE user_id = $1 AND end_time <= $2 ORDER BY end_time DESC LIMIT 1`, [req.user.id, appointment.start_time]),
      pool.query(`SELECT * FROM appointments WHERE user_id = $1 AND start_time >= $2 ORDER BY start_time ASC LIMIT 1`, [req.user.id, appointment.end_time]),
      pool.query(`SELECT * FROM buffer_time_analyses WHERE user_id = $1 AND applied = true ORDER BY created_at DESC LIMIT 10`, [req.user.id])
    ]);
    const analysis = await analyzeBufferTime(appointment, prevResult.rows[0], nextResult.rows[0], historyResult.rows);
    const insertResult = await pool.query(
      `INSERT INTO buffer_time_analyses (user_id, appointment_id, suggested_buffer_minutes, travel_time_estimate, preparation_time, decompression_time, confidence_score, ai_reasoning, optimization_tips)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, appointment_id, analysis.suggested_buffer_minutes, analysis.travel_time_estimate || 0, analysis.preparation_time || 0, analysis.decompression_time || 0, analysis.confidence_score || 0.5, analysis.reasoning, JSON.stringify(analysis.optimization_tips || [])]
    );
    const savedAnalysis = { ...insertResult.rows[0], appointment_title: appointment.title, start_time: appointment.start_time, location: appointment.location };
    res.json({ analysis: savedAnalysis, details: analysis, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Buffer analysis error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function applyBufferSuggestion(req, res) {
  try {
    const result = await pool.query(`UPDATE buffer_time_analyses SET applied = true WHERE id = $1 AND user_id = $2 RETURNING *`, [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Buffer analysis not found' });
    res.json({ message: 'Buffer suggestion applied', analysis: result.rows[0] });
  } catch (error) {
    console.error('Apply buffer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteBufferAnalysis(req, res) {
  try {
    const result = await pool.query('DELETE FROM buffer_time_analyses WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Buffer analysis not found' });
    res.json({ message: 'Buffer analysis deleted' });
  } catch (error) {
    console.error('Delete buffer analysis error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// ============================================
// AI NO-SHOW PREDICTOR
// ============================================

export async function getAllNoShowPredictions(req, res) {
  try {
    const { page, limit, offset, search } = getPaginationParams(req.query);
    let whereClause = 'WHERE nsp.user_id = $1';
    const params = [req.user.id];
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (a.title ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
    }
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM no_show_predictions nsp LEFT JOIN appointments a ON nsp.appointment_id = a.id LEFT JOIN contacts c ON a.contact_id = c.id ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(
      `SELECT nsp.*, a.title as appointment_title, a.start_time, c.name as contact_name
       FROM no_show_predictions nsp LEFT JOIN appointments a ON nsp.appointment_id = a.id LEFT JOIN contacts c ON a.contact_id = c.id
       ${whereClause} ORDER BY nsp.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get no-show predictions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function predictAppointmentNoShow(req, res) {
  const { appointment_id } = req.body;
  try {
    const aptResult = await pool.query(
      `SELECT a.*, c.name as contact_name, c.email as contact_email FROM appointments a LEFT JOIN contacts c ON a.contact_id = c.id WHERE a.id = $1 AND a.user_id = $2`,
      [appointment_id, req.user.id]
    );
    if (aptResult.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    const appointment = aptResult.rows[0];
    const [contactHistory, appointmentHistory] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) as count FROM appointments WHERE user_id = $1 AND contact_id = $2 GROUP BY status`, [req.user.id, appointment.contact_id]),
      pool.query(`SELECT * FROM no_show_predictions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [req.user.id])
    ]);
    const prediction = await predictNoShow(appointment, { name: appointment.contact_name, email: appointment.contact_email }, appointmentHistory.rows, contactHistory.rows);
    const insertResult = await pool.query(
      `INSERT INTO no_show_predictions (user_id, appointment_id, prediction_score, risk_level, contributing_factors, suggested_actions, recommended_reminders, ai_reasoning)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, appointment_id, prediction.prediction_score, prediction.risk_level, JSON.stringify(prediction.contributing_factors), JSON.stringify(prediction.suggested_actions), JSON.stringify(prediction.recommended_reminders || []), prediction.reasoning]
    );
    const savedPrediction = { ...insertResult.rows[0], appointment_title: appointment.title, start_time: appointment.start_time, contact_name: appointment.contact_name };
    res.json({ prediction: savedPrediction, details: prediction, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('No-show prediction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateNoShowOutcome(req, res) {
  const { actual_outcome } = req.body;
  try {
    const result = await pool.query(`UPDATE no_show_predictions SET actual_outcome = $1 WHERE id = $2 AND user_id = $3 RETURNING *`, [actual_outcome, req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prediction not found' });
    res.json({ message: 'Outcome updated', prediction: result.rows[0] });
  } catch (error) {
    console.error('Update outcome error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteNoShowPrediction(req, res) {
  try {
    const result = await pool.query('DELETE FROM no_show_predictions WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prediction not found' });
    res.json({ message: 'Prediction deleted' });
  } catch (error) {
    console.error('Delete prediction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// ============================================
// AI RESCHEDULE SUGGESTER
// ============================================

export async function getAllRescheduleSuggestions(req, res) {
  try {
    const { page, limit, offset, search } = getPaginationParams(req.query);
    let whereClause = 'WHERE rs.user_id = $1';
    const params = [req.user.id];
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (a.title ILIKE $${params.length} OR rs.reason_for_reschedule ILIKE $${params.length})`;
    }
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM reschedule_suggestions rs LEFT JOIN appointments a ON rs.original_appointment_id = a.id ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(
      `SELECT rs.*, a.title as appointment_title, a.start_time as original_time
       FROM reschedule_suggestions rs LEFT JOIN appointments a ON rs.original_appointment_id = a.id
       ${whereClause} ORDER BY rs.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get reschedule suggestions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getRescheduleSuggestions(req, res) {
  const { appointment_id, reason } = req.body;
  try {
    const aptResult = await pool.query('SELECT * FROM appointments WHERE id = $1 AND user_id = $2', [appointment_id, req.user.id]);
    if (aptResult.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    const existingResult = await pool.query(
      `SELECT * FROM appointments WHERE user_id = $1 AND start_time >= NOW() AND start_time <= NOW() + INTERVAL '14 days' ORDER BY start_time`,
      [req.user.id]
    );
    const settingsResult = await pool.query('SELECT * FROM settings WHERE user_id = $1', [req.user.id]);
    const suggestions = await suggestReschedule(aptResult.rows[0], existingResult.rows, settingsResult.rows[0] || {}, reason);
    const insertResult = await pool.query(
      `INSERT INTO reschedule_suggestions (user_id, original_appointment_id, suggested_times, reason_for_reschedule, priority_score, ai_reasoning, impact_analysis, alternative_approaches)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, appointment_id, JSON.stringify(suggestions.suggested_times), reason || 'User requested reschedule', suggestions.priority_score || 0.5, suggestions.reasoning, JSON.stringify(suggestions.impact_analysis || null), JSON.stringify(suggestions.alternative_approaches || [])]
    );
    const savedSuggestion = { ...insertResult.rows[0], appointment_title: aptResult.rows[0].title, original_time: aptResult.rows[0].start_time };
    res.json({ suggestion: savedSuggestion, details: suggestions, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Reschedule suggestion error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function acceptRescheduleSuggestion(req, res) {
  const { suggestion_index } = req.body;
  try {
    const result = await pool.query(`UPDATE reschedule_suggestions SET accepted_suggestion = $1 WHERE id = $2 AND user_id = $3 RETURNING *`, [suggestion_index, req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Suggestion not found' });
    res.json({ message: 'Suggestion accepted', suggestion: result.rows[0] });
  } catch (error) {
    console.error('Accept suggestion error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteRescheduleSuggestion(req, res) {
  try {
    const result = await pool.query('DELETE FROM reschedule_suggestions WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Suggestion not found' });
    res.json({ message: 'Suggestion deleted' });
  } catch (error) {
    console.error('Delete suggestion error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// ============================================
// AI RESOURCE ALLOCATOR
// ============================================

export async function getAllResources(req, res) {
  try {
    const { page, limit, offset, search } = getPaginationParams(req.query);
    let whereClause = 'WHERE user_id = $1';
    const params = [req.user.id];
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (name ILIKE $${params.length} OR type ILIKE $${params.length} OR location ILIKE $${params.length})`;
    }
    const countResult = await pool.query(`SELECT COUNT(*) FROM resources ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(
      `SELECT * FROM resources ${whereClause} ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createResource(req, res) {
  const { name, type, capacity, availability_hours, location, cost_per_hour, skills } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });
  try {
    const result = await pool.query(
      `INSERT INTO resources (user_id, name, type, capacity, availability_hours, location, cost_per_hour, skills) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, name, type, capacity || 1, availability_hours ? JSON.stringify(availability_hours) : null, location, cost_per_hour || 0, skills ? JSON.stringify(skills) : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateResource(req, res) {
  const { name, type, capacity, availability_hours, location, cost_per_hour, skills, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE resources SET name = COALESCE($1, name), type = COALESCE($2, type), capacity = COALESCE($3, capacity), availability_hours = COALESCE($4, availability_hours), location = COALESCE($5, location), cost_per_hour = COALESCE($6, cost_per_hour), skills = COALESCE($7, skills), is_active = COALESCE($8, is_active) WHERE id = $9 AND user_id = $10 RETURNING *`,
      [name, type, capacity, availability_hours ? JSON.stringify(availability_hours) : null, location, cost_per_hour, skills ? JSON.stringify(skills) : null, is_active, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update resource error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteResource(req, res) {
  try {
    const result = await pool.query('DELETE FROM resources WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });
    res.json({ message: 'Resource deleted' });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAllResourceAllocations(req, res) {
  try {
    const { page, limit, offset, search } = getPaginationParams(req.query);
    let whereClause = 'WHERE ra.user_id = $1';
    const params = [req.user.id];
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (a.title ILIKE $${params.length} OR r.name ILIKE $${params.length})`;
    }
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM resource_allocations ra LEFT JOIN appointments a ON ra.appointment_id = a.id LEFT JOIN resources r ON ra.resource_id = r.id ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(
      `SELECT ra.*, a.title as appointment_title, a.start_time, r.name as resource_name, r.type as resource_type
       FROM resource_allocations ra LEFT JOIN appointments a ON ra.appointment_id = a.id LEFT JOIN resources r ON ra.resource_id = r.id
       ${whereClause} ORDER BY ra.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get allocations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function optimizeAllocations(req, res) {
  const { appointment_ids, constraints } = req.body;
  try {
    let appointmentQuery = `SELECT * FROM appointments WHERE user_id = $1`;
    const params = [req.user.id];
    if (appointment_ids && appointment_ids.length > 0) {
      appointmentQuery += ` AND id = ANY($2)`;
      params.push(appointment_ids);
    } else {
      appointmentQuery += ` AND start_time >= NOW() ORDER BY start_time LIMIT 50`;
    }
    const [appointmentsResult, resourcesResult] = await Promise.all([
      pool.query(appointmentQuery, params),
      pool.query('SELECT * FROM resources WHERE user_id = $1 AND is_active = true', [req.user.id])
    ]);
    const appointments = appointmentsResult.rows;
    const resources = resourcesResult.rows;
    if (resources.length === 0) return res.status(400).json({ error: 'No resources available. Please add resources first.' });
    if (appointments.length === 0) return res.status(400).json({ error: 'No appointments found to allocate resources to.' });
    const optimization = await optimizeResourceAllocation(appointments, resources, constraints || {});
    const validAppointmentIds = new Set(appointments.map(a => a.id));
    const validResourceIds = new Set(resources.map(r => r.id));
    const savedAllocations = [];
    for (const allocation of (optimization.allocations || [])) {
      const aptId = parseInt(allocation.appointment_id);
      let resId = parseInt(allocation.resource_id);
      if (!validAppointmentIds.has(aptId)) continue;
      if (!validResourceIds.has(resId)) resId = resources[0].id;
      try {
        const insertResult = await pool.query(
          `INSERT INTO resource_allocations (user_id, appointment_id, resource_id, allocation_type, utilization_score, cost_efficiency_score, ai_reasoning) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [req.user.id, aptId, resId, allocation.allocation_type || 'primary', allocation.utilization_score || 0.7, allocation.cost_efficiency_score || 0.7, allocation.reasoning || 'AI-optimized allocation']
        );
        const apt = appointments.find(a => a.id === aptId);
        const resource = resources.find(r => r.id === resId);
        savedAllocations.push({ ...insertResult.rows[0], appointment_title: apt?.title, start_time: apt?.start_time, resource_name: resource?.name, resource_type: resource?.type });
      } catch (insertErr) {
        console.error('Failed to save allocation:', insertErr.message);
      }
    }
    res.json({ optimization, saved_allocations: savedAllocations, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Optimize allocations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteResourceAllocation(req, res) {
  try {
    const result = await pool.query('DELETE FROM resource_allocations WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Allocation not found' });
    res.json({ message: 'Allocation deleted' });
  } catch (error) {
    console.error('Delete allocation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// ============================================
// AI CONFLICT RESOLVER + SUMMARY
// ============================================

export async function resolveSchedulingConflicts(req, res) {
  const { conflicts } = req.body;
  if (!conflicts || !Array.isArray(conflicts)) {
    return res.status(400).json({ error: 'conflicts array is required' });
  }
  try {
    const appointmentsResult = await pool.query(`SELECT * FROM appointments WHERE user_id = $1 AND start_time >= NOW() ORDER BY start_time`, [req.user.id]);
    const settingsResult = await pool.query('SELECT * FROM settings WHERE user_id = $1', [req.user.id]);
    const resolutions = await resolveConflicts(conflicts, appointmentsResult.rows, settingsResult.rows[0] || {});

    // Persist resolution result for audit trail
    const insertResult = await pool.query(
      `INSERT INTO conflict_resolutions (user_id, resolutions, overall_strategy, impact_summary, preventive_measures, ai_powered)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        req.user.id,
        JSON.stringify(resolutions.resolutions || []),
        resolutions.overall_strategy || null,
        JSON.stringify(resolutions.impact_summary || null),
        JSON.stringify(resolutions.preventive_measures || []),
        isAIConfigured()
      ]
    );

    res.json({ resolutions, saved: insertResult.rows[0], ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Resolve conflicts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAllConflictResolutions(req, res) {
  try {
    const { page, limit, offset } = (await import('../utils/pagination.js')).getPaginationParams(req.query);
    const countResult = await pool.query('SELECT COUNT(*) FROM conflict_resolutions WHERE user_id = $1', [req.user.id]);
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(
      'SELECT * FROM conflict_resolutions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    );
    const { formatPaginatedResponse } = await import('../utils/pagination.js');
    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get conflict resolutions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAIFeaturesSummary(req, res) {
  try {
    const [bufferCount, noShowCount, rescheduleCount, resourceCount, allocationCount] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM buffer_time_analyses WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT COUNT(*) FROM no_show_predictions WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT COUNT(*) FROM reschedule_suggestions WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT COUNT(*) FROM resources WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT COUNT(*) FROM resource_allocations WHERE user_id = $1', [req.user.id])
    ]);
    res.json({
      ai_configured: isAIConfigured(),
      features: {
        buffer_time_optimizer: { name: 'AI Buffer Time Optimizer', description: 'Analyzes your schedule and suggests optimal buffer times between appointments', analyses_count: parseInt(bufferCount.rows[0].count), active: true },
        no_show_predictor: { name: 'AI No-Show Predictor', description: 'Predicts likelihood of appointment no-shows based on patterns', predictions_count: parseInt(noShowCount.rows[0].count), active: true },
        reschedule_suggester: { name: 'AI Reschedule Suggester', description: 'Suggests optimal alternative times when rescheduling appointments', suggestions_count: parseInt(rescheduleCount.rows[0].count), active: true },
        resource_allocator: { name: 'AI Resource Allocator', description: 'Optimizes allocation of resources to appointments', resources_count: parseInt(resourceCount.rows[0].count), allocations_count: parseInt(allocationCount.rows[0].count), active: true }
      }
    });
  } catch (error) {
    console.error('Get AI summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
