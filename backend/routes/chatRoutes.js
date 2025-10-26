const express = require('express');
const { body, validationResult } = require('express-validator');

const Chat = require('../models/Chat');
const Plant = require('../models/Plant');
const User = require('../models/User');
const { authenticateUser, consumerOrFarmer, checkOwnership } = require('../middleware/authMiddleware');

const router = express.Router();

// @route   GET /api/chat/:chatId
// @desc    Get chat messages
// @access  Private (User/Farmer)
router.get('/:chatId',
  authenticateUser,
  consumerOrFarmer,
  async (req, res) => {
    try {
      const chat = await Chat.findById(req.params.chatId)
        .populate('plantId', 'naturalName scientificName imageUrl')
        .populate('farmerId', 'firstName lastName email')
        .populate('userId', 'firstName lastName email');

      if (!chat) {
        return res.status(404).json({
          status: 'error',
          message: 'Chat not found'
        });
      }

      // Check if user is participant in this chat
      const isParticipant = chat.participants.some(
        participant => participant.userId.toString() === req.user._id.toString()
      );

      if (!isParticipant && req.user.role !== 'admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You are not a participant in this chat.'
        });
      }

      // Mark messages as read for current user
      const unreadField = req.user.role === 'farmer' ? 'farmer' : 'user';
      if (chat.unreadCount[unreadField] > 0) {
        await Chat.findByIdAndUpdate(req.params.chatId, {
          $set: { [`unreadCount.${unreadField}`]: 0 }
        });
      }

      res.json({
        status: 'success',
        data: chat
      });
    } catch (error) {
      console.error('Get chat error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch chat'
      });
    }
  }
);

// @route   POST /api/chat/:chatId/messages
// @desc    Send message in chat
// @access  Private (User/Farmer)
router.post('/:chatId/messages',
  authenticateUser,
  consumerOrFarmer,
  [
    body('message').isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { message, messageType = 'text' } = req.body;

      const chat = await Chat.findById(req.params.chatId);

      if (!chat) {
        return res.status(404).json({
          status: 'error',
          message: 'Chat not found'
        });
      }

      // Check if user is participant in this chat
      const isParticipant = chat.participants.some(
        participant => participant.userId.toString() === req.user._id.toString()
      );

      if (!isParticipant && req.user.role !== 'admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You are not a participant in this chat.'
        });
      }

      // Create new message
      const newMessage = {
        senderId: req.user._id,
        senderEmail: req.user.email,
        senderName: `${req.user.firstName} ${req.user.lastName}`,
        senderRole: req.user.role,
        message: message,
        messageType: messageType,
        timestamp: new Date()
      };

      // Update chat with new message
      const updatedChat = await Chat.findByIdAndUpdate(
        req.params.chatId,
        {
          $push: { messages: newMessage },
          $inc: {
            totalMessages: 1,
            [`unreadCount.${req.user.role === 'farmer' ? 'user' : 'farmer'}`]: 1
          },
          $set: { lastMessageAt: new Date() }
        },
        { new: true }
      );

      // Emit real-time message to other participants
      req.io.to(req.params.chatId).emit('receive-message', {
        chatId: req.params.chatId,
        message: newMessage,
        sender: {
          id: req.user._id,
          name: `${req.user.firstName} ${req.user.lastName}`,
          role: req.user.role
        }
      });

      res.status(201).json({
        status: 'success',
        message: 'Message sent successfully',
        data: {
          message: newMessage,
          chatId: req.params.chatId
        }
      });

    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to send message'
      });
    }
  }
);

// @route   PUT /api/chat/:chatId/messages/:messageId/read
// @desc    Mark message as read
// @access  Private (User/Farmer)
router.put('/:chatId/messages/:messageId/read',
  authenticateUser,
  consumerOrFarmer,
  async (req, res) => {
    try {
      const chat = await Chat.findById(req.params.chatId);

      if (!chat) {
        return res.status(404).json({
          status: 'error',
          message: 'Chat not found'
        });
      }

      // Check if user is participant in this chat
      const isParticipant = chat.participants.some(
        participant => participant.userId.toString() === req.user._id.toString()
      );

      if (!isParticipant && req.user.role !== 'admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You are not a participant in this chat.'
        });
      }

      // Find and update the specific message
      const messageIndex = chat.messages.findIndex(
        msg => msg._id.toString() === req.params.messageId
      );

      if (messageIndex === -1) {
        return res.status(404).json({
          status: 'error',
          message: 'Message not found'
        });
      }

      // Mark message as read
      chat.messages[messageIndex].isRead = true;
      chat.messages[messageIndex].readAt = new Date();

      await chat.save();

      res.json({
        status: 'success',
        message: 'Message marked as read'
      });

    } catch (error) {
      console.error('Mark message as read error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to mark message as read'
      });
    }
  }
);

// @route   DELETE /api/chat/:chatId
// @desc    Delete chat (deactivate)
// @access  Private (User/Farmer)
router.delete('/:chatId',
  authenticateUser,
  consumerOrFarmer,
  async (req, res) => {
    try {
      const chat = await Chat.findById(req.params.chatId);

      if (!chat) {
        return res.status(404).json({
          status: 'error',
          message: 'Chat not found'
        });
      }

      // Check if user is participant in this chat
      const isParticipant = chat.participants.some(
        participant => participant.userId.toString() === req.user._id.toString()
      );

      if (!isParticipant && req.user.role !== 'admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You are not a participant in this chat.'
        });
      }

      // Deactivate chat instead of deleting
      await Chat.findByIdAndUpdate(req.params.chatId, { isActive: false });

      res.json({
        status: 'success',
        message: 'Chat deactivated successfully'
      });

    } catch (error) {
      console.error('Delete chat error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete chat'
      });
    }
  }
);

// @route   POST /api/chat/:chatId/report
// @desc    Report inappropriate chat
// @access  Private (User/Farmer)
router.post('/:chatId/report',
  authenticateUser,
  consumerOrFarmer,
  [
    body('reason').isLength({ min: 10 }).withMessage('Report reason must be at least 10 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { reason } = req.body;

      const chat = await Chat.findById(req.params.chatId);

      if (!chat) {
        return res.status(404).json({
          status: 'error',
          message: 'Chat not found'
        });
      }

      // Check if user is participant in this chat
      const isParticipant = chat.participants.some(
        participant => participant.userId.toString() === req.user._id.toString()
      );

      if (!isParticipant && req.user.role !== 'admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You are not a participant in this chat.'
        });
      }

      // Update chat with report
      await Chat.findByIdAndUpdate(req.params.chatId, {
        isReported: true,
        reportReason: reason,
        reportedBy: req.user._id,
        reportedAt: new Date()
      });

      res.json({
        status: 'success',
        message: 'Chat reported successfully. Admin will review it.'
      });

    } catch (error) {
      console.error('Report chat error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to report chat'
      });
    }
  }
);

// @route   GET /api/chat/user/my-chats
// @desc    Get consumer's active chats
// @access  Private (Consumer)
router.get('/user/my-chats',
  authenticateUser,
  consumerOrFarmer,
  async (req, res) => {
    try {
      const chats = await Chat.find({
        userId: req.user._id,
        isActive: true
      })
        .populate('plantId', 'naturalName scientificName imageUrl')
        .populate('farmerId', 'firstName lastName email')
        .sort({ lastMessageAt: -1 });

      res.json({
        status: 'success',
        data: chats
      });
    } catch (error) {
      console.error('Get user chats error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch chats'
      });
    }
  }
);

// @route   GET /api/chat/admin/all-chats
// @desc    Get all chats for admin monitoring
// @access  Private (Admin)
router.get('/admin/all-chats',
  authenticateUser,
  async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. Admin only.'
        });
      }

      const { page = 1, limit = 50, reported = false } = req.query;
      const skip = (page - 1) * limit;

      // Build query
      const query = { isActive: true };
      if (reported === 'true') {
        query.isReported = true;
      }

      const chats = await Chat.find(query)
        .populate('plantId', 'naturalName scientificName imageUrl')
        .populate('farmerId', 'firstName lastName email')
        .populate('userId', 'firstName lastName email')
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Chat.countDocuments(query);

      res.json({
        status: 'success',
        data: {
          chats,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get admin chats error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch chats'
      });
    }
  }
);

// @route   GET /api/chat/farmer/my-chats
// @desc    Get farmer's active chats
// @access  Private (Farmer)
router.get('/farmer/my-chats',
  authenticateUser,
  consumerOrFarmer,
  async (req, res) => {
    try {
      const chats = await Chat.find({
        farmerId: req.user._id,
        isActive: true
      })
        .populate('plantId', 'naturalName scientificName imageUrl')
        .populate('userId', 'firstName lastName email')
        .sort({ lastMessageAt: -1 });

      res.json({
        status: 'success',
        data: chats
      });
    } catch (error) {
      console.error('Get farmer chats error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch chats'
      });
    }
  }
);

module.exports = router;
