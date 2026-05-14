import pool from '../config/database.js';

export async function initializeDatabase() {
  const client = await pool.connect();

  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create contacts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        company VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create appointments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'scheduled',
        reminder_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(7) DEFAULT '#3B82F6',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create reminders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
        remind_at TIMESTAMP NOT NULL,
        type VARCHAR(50) DEFAULT 'email',
        sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create nlp_logs table for tracking AI interactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS nlp_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        input_text TEXT NOT NULL,
        parsed_result JSONB,
        success BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create voice_commands table
    await client.query(`
      CREATE TABLE IF NOT EXISTS voice_commands (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        transcript TEXT NOT NULL,
        action_taken VARCHAR(255),
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        timezone VARCHAR(100) DEFAULT 'UTC',
        notification_email BOOLEAN DEFAULT TRUE,
        notification_sms BOOLEAN DEFAULT FALSE,
        default_reminder_minutes INTEGER DEFAULT 30,
        theme VARCHAR(50) DEFAULT 'light',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create buffer_time_analyses table for AI Buffer Time Optimizer
    await client.query(`
      CREATE TABLE IF NOT EXISTS buffer_time_analyses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
        suggested_buffer_minutes INTEGER NOT NULL,
        travel_time_estimate INTEGER,
        preparation_time INTEGER,
        decompression_time INTEGER,
        confidence_score DECIMAL(3,2),
        ai_reasoning TEXT,
        optimization_tips JSONB,
        applied BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add optimization_tips column if it doesn't exist (for existing databases)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE buffer_time_analyses ADD COLUMN IF NOT EXISTS optimization_tips JSONB;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    // Create no_show_predictions table for AI No-Show Predictor
    await client.query(`
      CREATE TABLE IF NOT EXISTS no_show_predictions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
        prediction_score DECIMAL(3,2) NOT NULL,
        risk_level VARCHAR(20) NOT NULL,
        contributing_factors JSONB,
        suggested_actions JSONB,
        recommended_reminders JSONB,
        ai_reasoning TEXT,
        actual_outcome VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add recommended_reminders column if it doesn't exist (for existing databases)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE no_show_predictions ADD COLUMN IF NOT EXISTS recommended_reminders JSONB;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    // Create reschedule_suggestions table for AI Reschedule Suggester
    await client.query(`
      CREATE TABLE IF NOT EXISTS reschedule_suggestions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        original_appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
        suggested_times JSONB NOT NULL,
        reason_for_reschedule VARCHAR(255),
        priority_score DECIMAL(3,2),
        ai_reasoning TEXT,
        impact_analysis JSONB,
        alternative_approaches JSONB,
        accepted_suggestion INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns if they don't exist (for existing databases)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE reschedule_suggestions ADD COLUMN IF NOT EXISTS impact_analysis JSONB;
        ALTER TABLE reschedule_suggestions ADD COLUMN IF NOT EXISTS alternative_approaches JSONB;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    // Create resources table for AI Resource Allocator
    await client.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        capacity INTEGER DEFAULT 1,
        availability_hours JSONB,
        location VARCHAR(255),
        cost_per_hour DECIMAL(10,2),
        skills JSONB,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create resource_allocations table for AI Resource Allocator
    await client.query(`
      CREATE TABLE IF NOT EXISTS resource_allocations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
        resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
        allocation_type VARCHAR(50),
        utilization_score DECIMAL(3,2),
        cost_efficiency_score DECIMAL(3,2),
        ai_reasoning TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create conflict_resolutions table for AI Conflict Resolver persistence
    await client.query(`
      CREATE TABLE IF NOT EXISTS conflict_resolutions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        resolutions JSONB NOT NULL,
        overall_strategy TEXT,
        impact_summary JSONB,
        preventive_measures JSONB,
        ai_powered BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create ai_results table for auditing raw AI calls
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        feature VARCHAR(100) NOT NULL,
        model_used VARCHAR(200),
        prompt_summary TEXT,
        raw_result JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create follow_up_drafts table for smart follow-up generator
    await client.query(`
      CREATE TABLE IF NOT EXISTS follow_up_drafts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
        draft_subject TEXT,
        draft_body TEXT,
        key_points JSONB,
        next_steps JSONB,
        sent BOOLEAN DEFAULT FALSE,
        ai_powered BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add tags column to appointments if it doesn't exist
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    // Add auth enhancement columns if they don't exist
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function dropAllTables() {
  const client = await pool.connect();

  try {
    await client.query(`
      DROP TABLE IF EXISTS follow_up_drafts CASCADE;
      DROP TABLE IF EXISTS ai_results CASCADE;
      DROP TABLE IF EXISTS conflict_resolutions CASCADE;
      DROP TABLE IF EXISTS resource_allocations CASCADE;
      DROP TABLE IF EXISTS resources CASCADE;
      DROP TABLE IF EXISTS reschedule_suggestions CASCADE;
      DROP TABLE IF EXISTS no_show_predictions CASCADE;
      DROP TABLE IF EXISTS buffer_time_analyses CASCADE;
      DROP TABLE IF EXISTS voice_commands CASCADE;
      DROP TABLE IF EXISTS nlp_logs CASCADE;
      DROP TABLE IF EXISTS reminders CASCADE;
      DROP TABLE IF EXISTS appointments CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
      DROP TABLE IF EXISTS contacts CASCADE;
      DROP TABLE IF EXISTS settings CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    console.log('All tables dropped successfully');
  } catch (error) {
    console.error('Error dropping tables:', error);
    throw error;
  } finally {
    client.release();
  }
}
