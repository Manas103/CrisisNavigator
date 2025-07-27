# AI Crisis Navigator - Real-Time Disaster Response System

## Overview

AI Crisis Navigator is a full-stack real-time disaster response system that ingests NASA EONET data, analyzes events with Google's Gemini AI, and displays interactive crisis maps for emergency management. The application combines modern web technologies with AI-powered analysis to provide actionable disaster response recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### 2024-01-26: Performance Optimization
- Implemented parallel batch processing for AI analysis (5x speed improvement)
- Reduced processing intervals from 60s to 30s 
- Added immediate startup processing for faster initial results
- Optimized data sorting to prioritize processed high-severity events
- Improved real-time broadcasting efficiency

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Maps**: Leaflet for interactive mapping with disaster visualization
- **Real-time Updates**: WebSocket connection for live data synchronization

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints with WebSocket support
- **Data Ingestion**: NASA EONET API integration for disaster event data
- **AI Processing**: Google Gemini AI for disaster analysis and response recommendations
- **Session Management**: Express session with PostgreSQL store

### Build System
- **Frontend Build**: Vite for fast development and optimized production builds
- **Backend Build**: esbuild for server-side bundling
- **Development**: tsx for TypeScript execution in development
- **Linting**: ESLint integration through Replit

## Key Components

### Data Ingestion Service
- Fetches real-time disaster data from NASA EONET API
- Transforms and normalizes event data for storage
- Handles rate limiting and error recovery
- Supports multiple disaster types (wildfires, earthquakes, storms, etc.)

### AI Analysis Engine
- Google Gemini integration for intelligent disaster analysis
- Generates severity scores (1-10 scale)
- Provides risk assessments and immediate action recommendations
- Creates evacuation guidance and resource allocation suggestions
- Processes both text and image data when available

### Real-time Dashboard
- Interactive map with disaster event markers
- Color-coded severity indicators (green/yellow/red)
- Live statistics panel with global event metrics
- Activity feed showing system events and updates
- Detailed response viewer with AI-generated recommendations

### WebSocket System
- Real-time data synchronization between server and clients
- Automatic reconnection handling
- Event-driven updates for disasters, stats, and activities
- Optimized for low-latency updates

## Data Flow

1. **Data Ingestion**: NASA EONET API provides disaster event data
2. **Data Processing**: Events are normalized and stored in the database
3. **AI Analysis**: Gemini AI analyzes events and generates response recommendations
4. **Storage**: Processed data and analysis results are persisted
5. **Real-time Distribution**: WebSocket broadcasts updates to connected clients
6. **Client Rendering**: React components display interactive maps and analysis

## External Dependencies

### Core Services
- **NASA EONET API**: Primary data source for disaster events
- **Google Gemini AI**: AI analysis and recommendation engine
- **Neon Database**: PostgreSQL hosting for data persistence

### Development Tools
- **Replit**: Development environment with integrated deployment
- **CDN Resources**: Leaflet maps, fonts, and external assets

### Key Libraries
- **Database**: Drizzle ORM with PostgreSQL adapter
- **Maps**: Leaflet with React integration
- **UI**: Radix UI primitives, Tailwind CSS
- **Real-time**: WebSocket (ws) for server, native WebSocket API for client
- **State Management**: TanStack Query for caching and synchronization

## Deployment Strategy

### Development Environment
- Replit-hosted development with hot reload
- Vite development server for frontend
- tsx for backend TypeScript execution
- Integrated database with Drizzle migrations

### Production Build
- Frontend: Vite production build with optimizations
- Backend: esbuild bundling for Node.js deployment
- Database migrations: Drizzle kit for schema management
- Static assets: Served through Express with caching headers

### Scaling Considerations
- Stateless server design for horizontal scaling
- Database connection pooling through Neon
- WebSocket clustering support for multiple instances
- CDN integration for static asset delivery

### Monitoring and Reliability
- Error handling with graceful degradation
- Automatic retry logic for external API calls
- Health check endpoints for service monitoring
- Structured logging for debugging and analytics