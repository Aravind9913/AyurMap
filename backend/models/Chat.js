const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  plantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plant',
    required: true
  },
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  farmerEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  userEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  plantName: {
    type: String,
    required: true
  },

  // Chat status
  isActive: {
    type: Boolean,
    default: true
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },

  // Chat participants
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    email: String,
    name: String,
    role: String,
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Messages
  messages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    senderEmail: {
      type: String,
      required: true
    },
    senderName: {
      type: String,
      required: true
    },
    senderRole: {
      type: String,
      enum: ['user', 'farmer', 'admin'],
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file'],
      default: 'text'
    },
    attachments: [{
      fileName: String,
      fileUrl: String,
      fileType: String,
      fileSize: Number
    }],
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: Date,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // Chat metadata
  totalMessages: {
    type: Number,
    default: 0
  },
  unreadCount: {
    farmer: {
      type: Number,
      default: 0
    },
    user: {
      type: Number,
      default: 0
    }
  },

  // Moderation
  isReported: {
    type: Boolean,
    default: false
  },
  reportReason: String,
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reportedAt: Date,
  adminNotes: String,

  // Typing status
  typing: {
    type: Boolean,
    default: false
  },
  typingBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  typingAt: Date
}, {
  timestamps: true
});

// Indexes for efficient queries
chatSchema.index({ plantId: 1 });
chatSchema.index({ farmerId: 1 });
chatSchema.index({ userId: 1 });
chatSchema.index({ farmerEmail: 1 });
chatSchema.index({ userEmail: 1 });
chatSchema.index({ isActive: 1 });
chatSchema.index({ lastMessageAt: -1 });
chatSchema.index({ isReported: 1 });

module.exports = mongoose.model('Chat', chatSchema);
