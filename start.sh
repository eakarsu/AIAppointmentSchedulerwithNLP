#!/bin/bash

# AI Appointment Scheduler with NLP - Startup Script
# This script will:
# 1. Clean up used ports (3000, 3001 - NOT 5000)
# 2. Install dependencies
# 3. Set up PostgreSQL database
# 4. Seed the database with sample data (15+ items per feature)
# 5. Start the backend and frontend servers

set -e

echo "================================================"
echo "  AI Appointment Scheduler with NLP"
echo "  Startup Script"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration (NOT using port 5000)
BACKEND_PORT=3001
FRONTEND_PORT=3000
DB_NAME="appointment_scheduler"
DB_USER="postgres"
DB_PASSWORD="postgres"

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_ai() {
    echo -e "${PURPLE}[AI]${NC} $1"
}

# Function to kill process on a port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        print_warning "Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Step 1: Clean up used ports
echo ""
echo "Step 1: Cleaning up used ports..."
echo "--------------------------------"
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT
# Also clean up any stray node processes
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1
print_status "Ports $FRONTEND_PORT and $BACKEND_PORT cleaned up"

# Step 2: Check for PostgreSQL
echo ""
echo "Step 2: Checking PostgreSQL..."
echo "------------------------------"

if command -v psql &> /dev/null; then
    print_status "PostgreSQL found"
else
    print_error "PostgreSQL is not installed!"
    echo "Please install PostgreSQL and try again."
    echo "  - macOS: brew install postgresql@15 && brew services start postgresql@15"
    echo "  - Ubuntu: sudo apt install postgresql postgresql-contrib"
    exit 1
fi

# Check if PostgreSQL is running
if pg_isready &> /dev/null; then
    print_status "PostgreSQL is running"
else
    print_warning "PostgreSQL is not running. Attempting to start..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start postgresql@15 2>/dev/null || brew services start postgresql 2>/dev/null || true
    else
        sudo systemctl start postgresql 2>/dev/null || sudo service postgresql start 2>/dev/null || true
    fi
    sleep 2
    if pg_isready &> /dev/null; then
        print_status "PostgreSQL started successfully"
    else
        print_error "Could not start PostgreSQL. Please start it manually."
        exit 1
    fi
fi

# Step 3: Create database if it doesn't exist
echo ""
echo "Step 3: Setting up database..."
echo "------------------------------"

# Try to create database (ignore error if exists)
createdb $DB_NAME 2>/dev/null || true
print_status "Database '$DB_NAME' ready"

# Step 4: Check .env file
echo ""
echo "Step 4: Checking environment configuration..."
echo "---------------------------------------------"

ENV_FILE="$SCRIPT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    print_status ".env file found"

    # Check if OpenRouter API key is configured
    if grep -q "OPENROUTER_API_KEY=your_openrouter_api_key_here" "$ENV_FILE"; then
        print_warning "OpenRouter API key not configured"
        print_ai "AI features will run in limited mode (fallback pattern matching)"
        echo "    To enable full AI features:"
        echo "    1. Get an API key from https://openrouter.ai/keys"
        echo "    2. Edit .env and replace 'your_openrouter_api_key_here' with your key"
    else
        print_ai "OpenRouter API key configured - Full AI features enabled!"
    fi
else
    print_warning ".env file not found, creating default..."
    cat > "$ENV_FILE" << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appointment_scheduler
DB_HOST=localhost
DB_PORT=5432
DB_NAME=appointment_scheduler
DB_USER=postgres
DB_PASSWORD=postgres

# Server Configuration (NOT using port 5000)
BACKEND_PORT=3001
FRONTEND_PORT=3000

# OpenRouter AI Configuration
# Get your API key from https://openrouter.ai/keys
OPENROUTER_API_KEY=your_openrouter_api_key_here

# AI Model Configuration
AI_MODEL=anthropic/claude-3-haiku
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=1000

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production_12345

# Demo User Credentials (for auto-fill login)
DEMO_EMAIL=demo@scheduler.com
DEMO_PASSWORD=demo123456
EOF
    print_status ".env file created"
fi

# Step 5: Install backend dependencies
echo ""
echo "Step 5: Installing backend dependencies..."
echo "------------------------------------------"
cd "$SCRIPT_DIR/backend"
if [ -f "package.json" ]; then
    npm install --silent
    print_status "Backend dependencies installed"
else
    print_error "Backend package.json not found!"
    exit 1
fi

# Step 6: Seed the database with 15+ items per feature
echo ""
echo "Step 6: Seeding database with sample data..."
echo "---------------------------------------------"
echo "    Seeding 16 Users..."
echo "    Seeding 16 Contacts..."
echo "    Seeding 16 Categories..."
echo "    Seeding 16 Appointments..."
echo "    Seeding 16 Reminders..."
echo "    Seeding 16 NLP Logs..."
echo "    Seeding 16 Voice Commands..."
echo "    Seeding 16 Settings..."
echo "    Seeding 16 Buffer Time Analyses..."
echo "    Seeding 16 No-Show Predictions..."
echo "    Seeding 16 Reschedule Suggestions..."
echo "    Seeding 16 Resources..."
echo "    Seeding 16 Resource Allocations..."
npm run seed
print_status "Database seeded with 15+ items for every feature"

# Step 7: Install frontend dependencies
echo ""
echo "Step 7: Installing frontend dependencies..."
echo "-------------------------------------------"
cd "$SCRIPT_DIR/frontend"
if [ -f "package.json" ]; then
    npm install --silent
    print_status "Frontend dependencies installed"
else
    print_error "Frontend package.json not found!"
    exit 1
fi

# Step 8: Start the servers
echo ""
echo "Step 8: Starting servers..."
echo "---------------------------"

# Go back to project root
cd "$SCRIPT_DIR"

# Start backend in background (with hot reload)
print_info "Starting backend server on port $BACKEND_PORT (hot reload enabled)..."
cd "$SCRIPT_DIR/backend"
npm run dev &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Wait for backend to be ready
sleep 3

# Check if backend started
if kill -0 $BACKEND_PID 2>/dev/null; then
    print_status "Backend started (PID: $BACKEND_PID)"
else
    print_error "Backend failed to start"
    exit 1
fi

# Start frontend
print_info "Starting frontend server on port $FRONTEND_PORT..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

# Wait for frontend to be ready
sleep 3

# Check if frontend started
if kill -0 $FRONTEND_PID 2>/dev/null; then
    print_status "Frontend started (PID: $FRONTEND_PID)"
else
    print_error "Frontend failed to start"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "================================================"
echo -e "${GREEN}  Application Started Successfully!${NC}"
echo "================================================"
echo ""
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo ""
echo "  Demo Login Credentials:"
echo "  -----------------------"
echo "  Email:    demo@scheduler.com"
echo "  Password: demo123456"
echo ""
echo "  (Click 'Fill Demo Credentials' button on login page)"
echo ""
echo -e "${GREEN}  Hot Reload: Enabled${NC}"
echo "  - Backend: Node --watch (auto-restarts on changes)"
echo "  - Frontend: Vite HMR (instant updates)"
echo ""
echo -e "${PURPLE}  AI Features:${NC}"
echo "  -----------------------"
echo "  - Natural Language Scheduling"
echo "  - Voice Commands"
echo "  - Smart Scheduling Suggestions"
echo "  - AI Chat Assistant"
echo "  - Conflict Detection"
echo "  - Schedule Insights"
echo "  - Smart Contact Search"
echo "  - Auto-categorization"
echo ""
echo -e "${PURPLE}  Advanced AI Features:${NC}"
echo "  -----------------------"
echo "  - AI Buffer Time Optimizer"
echo "  - AI No-Show Predictor"
echo "  - AI Reschedule Suggester"
echo "  - AI Resource Allocator"
echo "  - AI Conflict Resolver"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo ""

# Handle shutdown
cleanup() {
    echo ""
    print_info "Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    # Clean up any remaining processes
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    print_status "Servers stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait
