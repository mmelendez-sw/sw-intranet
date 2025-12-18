# Symphony Towers Infrastructure Intranet

A modern company intranet site built with React, TypeScript, and Vite.

## Features

- 🔐 Azure AD authentication with MSAL
- 👥 Role-based access control (Elite group support)
- 📊 Power BI report integration
- 🎨 Modern, responsive UI
- ⚡ Fast development with Vite
- 🛡️ Type-safe with TypeScript

## Prerequisites

- Node.js 18+ and npm/yarn
- Azure AD app registration configured

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_AZURE_CLIENT_ID=your-client-id-here
   VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id
   VITE_AZURE_REDIRECT_URI=https://intranet.symphonywireless.com
   VITE_ELITE_GROUP_ID=your-elite-group-id-here
   VITE_ENV=development
   ```

   For local development, you can use:
   ```env
   VITE_AZURE_REDIRECT_URI=http://localhost:3000
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Project Structure

```
src/
├── components/          # React components
│   ├── common/         # Reusable components (Button, Card, etc.)
│   ├── Header.tsx
│   ├── HomePage.tsx
│   ├── Reports.tsx
│   └── ...
├── contexts/           # React contexts (AuthContext)
├── data/              # Static data files
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── styles/            # CSS files
```

## Architecture

### Authentication

Authentication is handled through:
- **MSAL (Microsoft Authentication Library)** for Azure AD integration
- **AuthContext** for global auth state management
- **ProtectedRoute** component for route protection

### State Management

- React Context API for global state (authentication)
- Local component state for UI-specific state

### Code Splitting

Routes are lazy-loaded for optimal performance:
- HomePage
- ITPage
- Reports
- Other department pages

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_AZURE_CLIENT_ID` | Azure AD application client ID | Yes |
| `VITE_AZURE_AUTHORITY` | Azure AD tenant authority URL | Yes |
| `VITE_AZURE_REDIRECT_URI` | Redirect URI after authentication | Yes |
| `VITE_ELITE_GROUP_ID` | Azure AD group ID for elite access | Yes |
| `VITE_ENV` | Environment (development/production) | No |

## Building for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Deployment

The application can be deployed to:
- AWS Amplify
- Azure Static Web Apps
- Any static hosting service

Make sure to set the appropriate environment variables in your hosting platform.

## Contributing

1. Follow the existing code style
2. Run `npm run lint` before committing
3. Run `npm run format` to format code
4. Write meaningful commit messages

## License

Copyright © 2025 Symphony Towers Infrastructure. All rights reserved.
