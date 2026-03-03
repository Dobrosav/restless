# API Client - Desktop Application

A Postman alternative built with Electron, React, and TypeScript. Features Bruno-style collection format with full Postman import/export support.

## Features

- **HTTP Methods**: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Request Builder**: Headers, query params, body (JSON, text, form-data, x-www-form-urlencoded)
- **Authentication**: Basic Auth, Bearer Token, API Key
- **Monaco Editor**: Syntax highlighting for request body and scripts
- **Response Viewer**: JSON formatting, headers, timing, size
- **Bruno Format**: Native .bru file support
- **Postman Import/Export**: Full compatibility with Postman collections
- **Multi-platform**: Windows, macOS, Linux

## Prerequisites

- Node.js 18+
- npm 9+

## Installation

```bash
# Clone the repository
cd api-client

# Install dependencies
npm install

# Build the project
npm run build
```

## Development

### Running in Development Mode

```bash
# Start Vite dev server (runs on port 5173)
npm run dev
```

The app will open at `http://localhost:5173`

### Running with Electron

```bash
# First build the project
npm run build

# Then run Electron
npm run electron:dev
```

This opens the desktop application with the built frontend.

## Building for Production

### Windows (.exe)
```bash
npm run electron:build:win
```

### macOS (.dmg)
```bash
npm run electron:build:mac
```

### Linux (.AppImage)
```bash
npm run electron:build:linux
```

### Build All Platforms
```bash
npm run electron:build
```

Built applications are located in the `release/` directory.

## Usage

### Opening a Workspace

1. Click the "Open" button in the sidebar
2. Select a folder to use as your workspace
3. Collections are loaded from subfolders containing `.json` request files

### Creating a Request

1. Click "+ New" in the sidebar
2. Enter the URL
3. Select HTTP method
4. Add headers, params, body as needed
5. Click "Send" or press `Ctrl+Enter`

### Importing Postman Collections

1. Place a Postman collection `.json` file in your workspace
2. The app will automatically detect and import it
3. Collections appear in the sidebar

### Exporting to Postman Format

Requests can be exported as Postman collection JSON for use in Postman.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Send request |
| Ctrl+S | Save request |

## Project Structure

```
api-client/
├── electron/           # Electron main process
│   ├── main.ts         # App window, IPC handlers
│   └── preload.ts      # File system API
├── src/
│   ├── components/    # React components
│   │   ├── Sidebar.tsx       # Collection list
│   │   ├── RequestPanel.tsx  # Request editor
│   │   └── ResponsePanel.tsx # Response viewer
│   ├── lib/           # Core logic
│   │   ├── httpClient.ts     # HTTP requests (axios)
│   │   ├── bruParser.ts     # Bruno .bru format
│   │   └── postmanImport.ts # Postman import/export
│   ├── stores/        # React context
│   └── types/         # TypeScript definitions
├── dist/              # Vite build output
└── release/           # Electron builder output
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Editor**: Monaco Editor
- **HTTP Client**: Axios
- **Desktop**: Electron 40
- **Build**: electron-builder

## License

MIT
