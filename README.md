# AyurMap - Ayurvedic Plant Locator Platform

A comprehensive platform that bridges the gap between local farmers and users seeking Ayurvedic plants. AyurMap enables plant identification, location-based discovery, and direct communication between farmers and users.

## 📋 Requirements

### System Requirements

- **Node.js**: v14 or higher
- **npm**: v6 or higher (comes with Node.js)
- **MongoDB**: v4.4 or higher (local installation or cloud instance)
- **Git**: For version control

### API Keys Required

- **Clerk Account**: For authentication and user management
  - Clerk Secret Key
  - Clerk Publishable Key
- **Plant.id API Key**: For AI-powered plant identification
- **Groq API Key**: For generating Ayurvedic descriptions
- **MongoDB Connection String**: For database connection

### Environment Setup

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection for API services
- Port 5000 (backend) and 8080 (frontend) available

## 🛠️ Tools

### Development Tools

- **Node.js**: JavaScript runtime environment
- **npm**: Package manager for Node.js
- **Git**: Version control system
- **VS Code / Cursor**: Recommended IDE
- **Postman / Thunder Client**: API testing (optional)
- **MongoDB Compass**: Database GUI (optional)

### Build Tools

- **Vite**: Frontend build tool and dev server
- **TypeScript**: Type-safe JavaScript
- **SWC**: Fast TypeScript/JavaScript compiler
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

### Testing Tools

- **Jest**: Backend testing framework
- **Vitest**: Frontend testing framework
- **Nodemon**: Auto-restart for backend development

### API Services & External Tools

- **Clerk**: Authentication and user management service
- **Plant.id API**: AI-powered plant identification service
- **Groq API**: AI service for generating Ayurvedic descriptions
- **Node Geocoder**: Geocoding and reverse geocoding service
- **Socket.io**: Real-time bidirectional communication
- **Leaflet**: Interactive maps library

## 🚀 Tech Stack

### Frontend

- **Framework**: React 18.3.1
- **Language**: TypeScript 5.9.2
- **Build Tool**: Vite 7.1.2
- **Routing**: React Router DOM 6.30.1
- **State Management**: TanStack React Query 5.84.2
- **UI Components**: 
  - Radix UI (Dialog, Label, Separator, Toast, Tooltip)
  - Custom UI components with Tailwind CSS
- **Styling**: 
  - Tailwind CSS 3.4.17
  - Tailwind Animate 1.0.7
  - Tailwind Typography 0.5.16
  - CSS Modules
- **Maps**: 
  - Leaflet 1.9.4
  - React Leaflet 5.0.0
- **Authentication**: Clerk React 5.53.3
- **Real-time**: Socket.io Client 4.8.1
- **Markdown**: React Markdown 10.1.0
- **Theming**: Next Themes 0.4.6
- **Icons**: Lucide React 0.539.0
- **Notifications**: Sonner 1.7.4

### Backend

- **Runtime**: Node.js
- **Framework**: Express.js 4.18.2
- **Language**: JavaScript (ES6+)
- **Database**: 
  - MongoDB (database)
  - Mongoose 8.0.3 (ODM)
- **Authentication**: 
  - Clerk (authentication service)
  - JSON Web Tokens 9.0.2
- **Real-time**: Socket.io 4.7.4
- **File Upload**: Multer 1.4.5-lts.1
- **Validation**: Express Validator 7.0.1
- **Security**: 
  - Helmet 7.1.0
  - CORS 2.8.5
  - Express Rate Limit 7.1.5
- **HTTP Client**: Axios 1.6.2
- **Geocoding**: Node Geocoder 4.2.0
- **Logging**: Morgan 1.10.0
- **Environment**: dotenv 16.3.1

### Database

- **Database**: MongoDB
- **ODM**: Mongoose
- **Storage**: 
  - MongoDB GridFS (for file storage)
  - Local file system (uploads/plants/)

### DevOps & Deployment

- **Process Manager**: Node.js process manager (PM2 recommended for production)
- **Environment**: dotenv for environment variable management
- **Version Control**: Git

## 📦 Project Structure

```
AyurMap-main/
├── backend/              # Node.js/Express backend
│   ├── middleware/       # Authentication, error handling
│   ├── models/          # MongoDB models (User, Plant, Chat)
│   ├── routes/          # API routes (admin, farmer, user, chat)
│   ├── services/        # External API services (Groq, Plant.id, Geocoding)
│   ├── utils/           # Utility functions (GridFS storage)
│   └── server.js        # Main server file
│
└── frontend/            # React/TypeScript frontend
    └── client/          # React application
        ├── components/  # React components
        ├── pages/       # Page components
        ├── hooks/       # Custom React hooks
        └── lib/         # Utility libraries
```

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AyurMap-main
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ayurmap
PLANT_ID_API_KEY=your_plant_id_api_key
GROQ_API_KEY=your_groq_api_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
FRONTEND_URL=http://localhost:8080
ADMIN_EMAIL=your_admin_email@example.com
```

Start the backend:

```bash
npm run dev  # Development mode
# or
npm start    # Production mode
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the frontend directory:

```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

The application will be available at `http://localhost:8080`

## 📚 Additional Resources

- [Backend README](./backend/README.md) - Detailed backend documentation
- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Clerk Documentation](https://clerk.com/docs)
- [Plant.id API Documentation](https://plant.id/docs)
- [Groq API Documentation](https://console.groq.com/docs)

## 📄 License

This project is licensed under the MIT License.

---

**AyurMap** - Bridging the gap between Ayurvedic knowledge and modern technology. 🌿
