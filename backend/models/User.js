const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  clerkId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: false,
    default: ''
  },
  role: {
    type: String,
    enum: ['consumer', 'farmer', 'admin'],
    default: 'consumer'
  },
  profileImage: {
    type: String,
    default: ''
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String,
    city: String,
    state: String,
    country: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  searchHistory: [{
    query: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    results: [{
      plantId: mongoose.Schema.Types.ObjectId,
      relevanceScore: Number
    }]
  }]
}, {
  timestamps: true
});

// Index for efficient queries
userSchema.index({ email: 1 });
userSchema.index({ clerkId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

module.exports = mongoose.model('User', userSchema);
