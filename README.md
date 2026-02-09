# TEJUS 2026 Project Expo Voting

Production-ready full-stack voting platform for TEJUS 2026 at Anurag University. The system enforces one vote per device per project, generates QR codes for each project, and provides a mobile-first UI.

## Features
- QR-driven project voting flow
- Server-side enforcement of one vote per project per device
- Locked voter name per device
- Animated mobile-first UI with live scoring feedback
- Configurable database provider: MongoDB, PostgreSQL, or MySQL
- Seed script for 150+ projects
- QR code generator for all projects

## Tech Stack
- Backend: Node.js (LTS), Express.js, ES6 modules
- Database: MongoDB / PostgreSQL / MySQL
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Utilities: QR code generator, device fingerprinting in JS

## Setup
1. Install dependencies
   - `npm install`
2. Create environment file
   - Copy `.env.example` to `.env` and update values
3. Seed database
   - `npm run seed`
4. Generate QR codes
   - `npm run generate:qr`
5. Run server
   - `npm run dev` or `npm start`

## Environment Variables
- `PORT`: Server port (default 3000)
- `NODE_ENV`: development/production
- `DB_PROVIDER`: `mongo` | `postgres` | `mysql`
- `DB_URL`: Connection string for selected provider
- `DB_IN_MEMORY`: `true` to use an in-memory MongoDB instance for local demo
- `QR_BASE_URL`: Base URL used to generate QR codes

## Architecture Overview
- `src/app.js`: Express app setup and middleware
- `src/server.js`: Server bootstrap
- `src/routes`: REST API routing
- `src/controllers`: Request handlers
- `src/services`: Business logic and validation flow
- `src/db`: Database adapters (Mongo + SQL)
- `public`: Static frontend assets
- `scripts`: Seed and QR generation utilities

## REST API
### Fetch project by ID
`GET /api/projects/:projectId`

Response
```json
{
  "id": "PRJ-001",
  "title": "Nova Sense",
  "teamName": "Team A1",
  "category": "AI & ML",
  "description": "..."
}
```

### Check eligibility
`GET /api/votes/check?projectId=PRJ-001&deviceHash=...`

Response
```json
{
  "eligible": true,
  "reason": null,
  "voterName": "..."
}
```

### Submit vote
`POST /api/votes`

Body
```json
{
  "projectId": "PRJ-001",
  "deviceHash": "...",
  "voterName": "Alex",
  "score": 8
}
```

Response
```json
{
  "id": "<vote-uuid>",
  "message": "Your vote has been recorded successfully.",
  "timestamp": "2026-02-09T10:00:00.000Z"
}
```

## Security & Rules Enforced
- Project existence validation
- Score validation (0–10 integer only)
- One vote per device per project
- Voter name locked per device
- Centralized error handling and rate limiting

## QR Code Flow
QRs point to:
```
/vote?projectId=<unique_project_id>
```
The backend loads only that project’s data and enforces voting rules.

## Future Enhancements
- Admin dashboard with real-time analytics
- Export votes to CSV
- Multi-language support
- Offline caching for unstable networks

## Notes
- The AU logo is a placeholder SVG in `public/assets/` and should be replaced with the official logo.
