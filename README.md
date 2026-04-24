# AI Appointment Scheduler with NLP

An intelligent appointment scheduling application that understands natural language commands like "Book me Tuesday afternoon" via text or voice input.

## Features

- **NLP Text Input**: Schedule appointments using natural language (e.g., "Book me Tuesday afternoon", "Schedule meeting with Dr. Sarah tomorrow at 2pm")
- **Voice Commands**: Use your microphone to speak commands directly
- **Appointment Management**: Full CRUD operations for appointments
- **Contact Management**: Manage your contacts directory
- **Categories**: Organize appointments by categories with custom colors
- **Reminders**: Set email/SMS reminders for appointments
- **NLP Logs**: View history of AI interactions
- **Voice Command History**: Track all voice commands
- **User Settings**: Customize timezone, notifications, and preferences

## Tech Stack

- **Frontend**: React 18, React Router, Tailwind CSS, Vite
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **AI**: OpenRouter API (for NLP processing)
- **Voice**: Web Speech API

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- OpenRouter API key (optional, mock responses work without it)

## Quick Start

1. **Clone and navigate to the project**:
   ```bash
   cd ai-appointment-scheduler
   ```

2. **Configure environment**:
   Edit `.env` file and add your OpenRouter API key:
   ```
   OPENROUTER_API_KEY=your_api_key_here
   ```

3. **Run the application**:
   ```bash
   ./start.sh
   ```

   This script will:
   - Clean up any used ports (3000, 3001)
   - Set up PostgreSQL database
   - Install all dependencies
   - Seed the database with sample data (15+ items per feature)
   - Start both frontend and backend servers

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Demo Credentials

Click the "Fill Demo Credentials" button on the login page, or use:
- **Email**: demo@scheduler.com
- **Password**: demo123456

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/auth/profile` - Get user profile
- `GET /api/auth/demo-credentials` - Get demo credentials

### Appointments
- `GET /api/appointments` - List all appointments
- `GET /api/appointments/upcoming` - List upcoming appointments
- `GET /api/appointments/:id` - Get appointment details
- `POST /api/appointments` - Create appointment
- `POST /api/appointments/nlp` - Create from natural language
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Delete appointment

### Contacts
- `GET /api/contacts` - List all contacts
- `GET /api/contacts/:id` - Get contact details
- `POST /api/contacts` - Create contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact

### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Reminders
- `GET /api/reminders` - List all reminders
- `POST /api/reminders` - Create reminder
- `PUT /api/reminders/:id` - Update reminder
- `DELETE /api/reminders/:id` - Delete reminder

### NLP
- `GET /api/nlp/logs` - List NLP logs
- `POST /api/nlp/parse` - Parse text
- `POST /api/nlp/suggestions` - Get AI suggestions

### Voice Commands
- `GET /api/voice` - List voice commands
- `POST /api/voice/process` - Process voice command

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings

## Natural Language Examples

The AI understands various formats:
- "Book me Tuesday afternoon"
- "Schedule meeting with Dr. Sarah tomorrow at 2pm"
- "Cancel my 3pm appointment"
- "Move my meeting to 4pm"
- "What appointments do I have this week"
- "Remind me about the meeting in 30 minutes"

## Project Structure

```
ai-appointment-scheduler/
├── .env                    # Environment variables
├── start.sh               # Startup script
├── README.md
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js      # Express server
│       ├── seed.js        # Database seeding
│       ├── config/
│       │   └── database.js
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── appointmentController.js
│       │   ├── contactController.js
│       │   ├── categoryController.js
│       │   ├── reminderController.js
│       │   ├── nlpController.js
│       │   ├── voiceController.js
│       │   └── settingsController.js
│       ├── middleware/
│       │   └── auth.js
│       ├── models/
│       │   └── schema.js
│       ├── routes/
│       │   ├── auth.js
│       │   ├── appointments.js
│       │   ├── contacts.js
│       │   ├── categories.js
│       │   ├── reminders.js
│       │   ├── nlp.js
│       │   ├── voice.js
│       │   └── settings.js
│       └── services/
│           └── openrouter.js
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── components/
        │   └── Layout.jsx
        ├── context/
        │   └── AuthContext.jsx
        ├── pages/
        │   ├── Login.jsx
        │   ├── Dashboard.jsx
        │   ├── Appointments.jsx
        │   ├── Contacts.jsx
        │   ├── Categories.jsx
        │   ├── Reminders.jsx
        │   ├── NlpLogs.jsx
        │   ├── VoiceCommands.jsx
        │   └── Settings.jsx
        └── services/
            └── api.js
```

## Seeded Data

The database is seeded with 15+ items for each feature:
- 16 Users
- 16 Contacts
- 16 Categories
- 16 Appointments
- 16 Reminders
- 16 NLP Logs
- 16 Voice Commands
- 16 User Settings

## License

MIT
