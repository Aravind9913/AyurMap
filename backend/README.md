# AyurMap Backend - Ayurvedic Plant Locator API

A comprehensive Node.js backend API for the AyurMap Plant Locator platform, designed to bridge the gap between local farmers and users seeking Ayurvedic plants.

## 🌱 Project Overview

AyurMap is a role-based platform with three main user types:
- **Farmers**: Upload and manage Ayurvedic plant information
- **Users**: Search for plants and connect with farmers
- **Admin**: Manage the entire platform

## ✨ Key Features

### For Farmers
- Upload plant images with automatic AI identification using Plant.id API
- AI-generated Ayurvedic descriptions using Groq API
- Automatic geolocation capture
- Manage uploaded plants (view, edit, delete)
- Real-time chat with users

### For Users
- Search plants by condition or query using AI
- Location-based plant discovery (50-100km radius)
- Interactive map with plant markers
- Direct chat with farmers
- Search history tracking

### For Admin
- Complete platform management
- User, farmer, and plant management
- Chat moderation
- Analytics and reporting
- Data export capabilities

## 🚀 Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: Clerk
- **AI Services**: 
  - Plant.id API (plant identification)
  - Groq API (Ayurvedic descriptions)
- **Real-time**: Socket.io
- **File Upload**: Multer
- **Security**: Helmet, CORS, Rate Limiting

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud)
- Clerk account for authentication
- Plant.id API key
- Groq API key

## 🛠️ Installation & Setup

### 1. Clone and Install Dependencies

```bash
# Install dependencies
npm install
```

### 2. Environment Configuration

Copy `config.env` and update with your API keys:

```env
# Environment Variables for AyurMap Backend
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ayurmap

# API Keys
PLANT_ID_API_KEY=your_plant_id_api_key
GROQ_API_KEY=your_groq_api_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Admin Configuration
ADMIN_EMAIL=your_admin_email@example.com

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=uploads/

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Database Setup

Make sure MongoDB is running locally or update `MONGODB_URI` with your cloud database connection string.

### 4. Start the Server

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## 📚 API Documentation

### Authentication

All protected routes require a Clerk authentication token in the header:
```
Authorization: Bearer <clerk_session_token>
```

### Farmer Routes

#### Upload Plant
```
POST /api/farmer/upload-plant
Content-Type: multipart/form-data

Body:
- plantImage: Image file (required)
- latitude: Number (required)
- longitude: Number (required)
- phoneNumber: String (optional)
- address: String (optional)
- city: String (optional)
- state: String (optional)
- country: String (optional)
```

#### Get My Plants
```
GET /api/farmer/my-plants?page=1&limit=10&sortBy=createdAt&sortOrder=desc
```

#### Update Plant
```
PUT /api/farmer/plants/:id
Body: {
  naturalName: String,
  scientificName: String,
  ayurvedicDescription: String,
  medicinalBenefits: String,
  // ... other fields
}
```

#### Delete Plant
```
DELETE /api/farmer/plants/:id
```

### User Routes

#### Search Plants
```
POST /api/user/search-plants
Body: {
  query: String (required),
  latitude: Number (optional),
  longitude: Number (optional),
  radius: Number (optional, default: 50)
}
```

#### Get Nearby Plants
```
GET /api/user/plants-nearby?latitude=12.9716&longitude=77.5946&radius=50
```

#### Start Chat
```
POST /api/user/start-chat
Body: {
  plantId: String (required)
}
```

### Admin Routes

#### Dashboard Analytics
```
GET /api/admin/dashboard
```

#### Manage Users
```
GET /api/admin/users?page=1&limit=20&role=farmer&search=john
DELETE /api/admin/users/:id
PUT /api/admin/users/:id/role
```

#### Manage Plants
```
GET /api/admin/plants?page=1&limit=20&farmerEmail=farmer@example.com
DELETE /api/admin/plants/:id
PUT /api/admin/plants/:id/verify
```

#### Manage Chats
```
GET /api/admin/chats?page=1&limit=20&isReported=true
DELETE /api/admin/chats/:id
PUT /api/admin/chats/:id/resolve-report
```

### Chat Routes

#### Get Chat Messages
```
GET /api/chat/:chatId
```

#### Send Message
```
POST /api/chat/:chatId/messages
Body: {
  message: String (required),
  messageType: String (optional, default: 'text')
}
```

#### Mark Message as Read
```
PUT /api/chat/:chatId/messages/:messageId/read
```

## 🔧 Configuration

### Role Assignment

Users are automatically assigned roles based on their email:
- Admin: Email matches `ADMIN_EMAIL` in config
- Farmer: Users who upload plants (role changes from 'user' to 'farmer')
- User: Default role for all new users

### File Upload

- Supported formats: JPEG, JPG, PNG, GIF, WebP
- Maximum file size: 10MB (configurable)
- Files stored in `uploads/plants/` directory

### Rate Limiting

- 100 requests per 15 minutes per IP
- Configurable via environment variables

## 🗄️ Database Models

### User Model
- Clerk integration
- Role-based access
- Location tracking
- Search history

### Plant Model
- Farmer association
- AI-generated content
- Geolocation data
- Analytics tracking

### Chat Model
- Real-time messaging
- Participant management
- Moderation features
- Message history

## 🔒 Security Features

- Clerk authentication
- Role-based authorization
- Input validation
- File upload security
- Rate limiting
- CORS protection
- Helmet security headers

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ayurmap
FRONTEND_URL=https://your-frontend-domain.com
```

### Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 📊 Monitoring & Analytics

The admin dashboard provides:
- User and farmer statistics
- Plant upload analytics
- Chat activity monitoring
- Geographic distribution
- Top viewed plants

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the API documentation above
- Review the error logs
- Ensure all environment variables are properly set
- Verify API key configurations

## 🔄 API Integration Status

- ✅ Clerk Authentication
- ✅ Plant.id API Integration
- ✅ Groq AI Integration
- ✅ Real-time Chat (Socket.io)
- ✅ File Upload (Multer)
- ✅ Geolocation Services
- ✅ Role-based Access Control

---

**AyurMap Backend** - Bridging the gap between Ayurvedic knowledge and modern technology. 🌿
