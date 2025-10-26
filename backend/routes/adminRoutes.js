const express = require('express');
const { body, validationResult } = require('express-validator');
const fs = require('fs');

const User = require('../models/User');
const Plant = require('../models/Plant');
const Chat = require('../models/Chat');
const { authenticateUser, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard analytics
// @access  Private (Admin)
router.get('/dashboard', authenticateUser, adminOnly, async (req, res) => {
  try {
    // Get total counts
    const totalUsers = await User.countDocuments({ role: { $in: ['consumer', 'farmer'] } });
    const totalFarmers = await User.countDocuments({ role: 'farmer' });
    const totalConsumers = await User.countDocuments({ role: 'consumer' });
    const totalPlants = await Plant.countDocuments({ isActive: true });
    const totalChats = await Chat.countDocuments({ isActive: true });
    const reportedChats = await Chat.countDocuments({ isReported: true });

    // Debug: Check all users
    const allUsers = await User.find({}, 'role email');
    console.log('📊 All users in DB:', allUsers.map(u => ({ email: u.email, role: u.role })));
    console.log('📊 Dashboard stats:', { totalUsers, totalFarmers, totalConsumers, totalPlants, totalChats });

    // Get recent activity
    const recentPlants = await Plant.find({ isActive: true })
      .populate('farmerId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('-plantIdResponse -groqResponse');

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('-searchHistory');

    // Get analytics by farmer
    const farmerStats = await Plant.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$farmerId',
          farmerName: { $first: '$farmerName' },
          farmerEmail: { $first: '$farmerEmail' },
          totalPlants: { $sum: 1 },
          totalViews: { $sum: '$viewCount' },
          totalChats: { $sum: '$chatCount' }
        }
      },
      { $sort: { totalPlants: -1 } },
      { $limit: 10 }
    ]);

    // Get monthly plant uploads
    const monthlyStats = await Plant.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    // Get top viewed plants
    const topViewedPlants = await Plant.find({ isActive: true })
      .sort({ viewCount: -1 })
      .limit(10)
      .select('naturalName scientificName viewCount farmerName createdAt');

    res.json({
      status: 'success',
      data: {
        overview: {
          totalUsers,
          totalConsumers,
          totalFarmers,
          totalPlants,
          totalChats,
          reportedChats
        },
        recentActivity: {
          plants: recentPlants,
          users: recentUsers
        },
        farmerStats,
        monthlyStats,
        topViewedPlants
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard data'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination
// @access  Private (Admin)
router.get('/users', authenticateUser, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-searchHistory')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      status: 'success',
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users'
    });
  }
});

// @route   GET /api/admin/plants
// @desc    Get all plants with pagination
// @access  Private (Admin)
router.get('/plants', authenticateUser, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, farmerEmail, isActive, search } = req.query;

    const filter = {};
    if (farmerEmail) filter.farmerEmail = farmerEmail;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { naturalName: { $regex: search, $options: 'i' } },
        { scientificName: { $regex: search, $options: 'i' } },
        { farmerName: { $regex: search, $options: 'i' } }
      ];
    }

    const plants = await Plant.find(filter)
      .populate('farmerId', 'firstName lastName email')
      .select('-plantIdResponse -groqResponse')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Plant.countDocuments(filter);

    res.json({
      status: 'success',
      data: {
        plants,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalPlants: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get plants error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch plants'
    });
  }
});

// @route   GET /api/admin/chats
// @desc    Get all chats with pagination
// @access  Private (Admin)
router.get('/chats', authenticateUser, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, isReported } = req.query;

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isReported !== undefined) filter.isReported = isReported === 'true';

    const chats = await Chat.find(filter)
      .populate('plantId', 'naturalName scientificName imageUrl')
      .populate('farmerId', 'firstName lastName email')
      .populate('userId', 'firstName lastName email')
      .sort({ lastMessageAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Chat.countDocuments(filter);

    res.json({
      status: 'success',
      data: {
        chats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalChats: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch chats'
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private (Admin)
router.delete('/users/:id', authenticateUser, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (user.email === process.env.ADMIN_EMAIL) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete admin account'
      });
    }

    // Delete user's plants and their images
    const userPlants = await Plant.find({ farmerId: user._id });
    for (const plant of userPlants) {
      if (plant.imagePath && fs.existsSync(plant.imagePath)) {
        fs.unlinkSync(plant.imagePath);
      }
    }
    await Plant.deleteMany({ farmerId: user._id });

    // Deactivate user's chats
    await Chat.updateMany(
      { $or: [{ farmerId: user._id }, { userId: user._id }] },
      { isActive: false }
    );

    // Delete user
    await User.findByIdAndDelete(req.params.id);

    res.json({
      status: 'success',
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete user'
    });
  }
});

// @route   DELETE /api/admin/plants/:id
// @desc    Delete plant
// @access  Private (Admin)
router.delete('/plants/:id', authenticateUser, adminOnly, async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id);

    if (!plant) {
      return res.status(404).json({
        status: 'error',
        message: 'Plant not found'
      });
    }

    // Delete the image file
    if (plant.imagePath && fs.existsSync(plant.imagePath)) {
      fs.unlinkSync(plant.imagePath);
    }

    // Deactivate related chats
    await Chat.updateMany({ plantId: plant._id }, { isActive: false });

    // Delete plant
    await Plant.findByIdAndDelete(req.params.id);

    res.json({
      status: 'success',
      message: 'Plant deleted successfully'
    });
  } catch (error) {
    console.error('Delete plant error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete plant'
    });
  }
});

// @route   PUT /api/admin/plants/:id/verify
// @desc    Verify or unverify plant
// @access  Private (Admin)
router.put('/plants/:id/verify',
  authenticateUser,
  adminOnly,
  [
    body('isVerified').isBoolean().withMessage('isVerified must be a boolean'),
    body('notes').optional().isString().withMessage('Notes must be a string')
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

      const { isVerified, notes } = req.body;

      const plant = await Plant.findByIdAndUpdate(
        req.params.id,
        {
          isVerified,
          verificationNotes: notes || ''
        },
        { new: true }
      );

      if (!plant) {
        return res.status(404).json({
          status: 'error',
          message: 'Plant not found'
        });
      }

      res.json({
        status: 'success',
        message: `Plant ${isVerified ? 'verified' : 'unverified'} successfully`,
        data: plant
      });
    } catch (error) {
      console.error('Verify plant error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update plant verification'
      });
    }
  }
);

// @route   PUT /api/admin/chats/:id/resolve-report
// @desc    Resolve reported chat
// @access  Private (Admin)
router.put('/chats/:id/resolve-report',
  authenticateUser,
  adminOnly,
  [
    body('adminNotes').optional().isString().withMessage('Admin notes must be a string')
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

      const { adminNotes } = req.body;

      const chat = await Chat.findByIdAndUpdate(
        req.params.id,
        {
          isReported: false,
          adminNotes: adminNotes || ''
        },
        { new: true }
      );

      if (!chat) {
        return res.status(404).json({
          status: 'error',
          message: 'Chat not found'
        });
      }

      res.json({
        status: 'success',
        message: 'Chat report resolved successfully',
        data: chat
      });
    } catch (error) {
      console.error('Resolve chat report error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to resolve chat report'
      });
    }
  }
);

// @route   DELETE /api/admin/chats/:id
// @desc    Delete chat
// @access  Private (Admin)
router.delete('/chats/:id', authenticateUser, adminOnly, async (req, res) => {
  try {
    const chat = await Chat.findByIdAndDelete(req.params.id);

    if (!chat) {
      return res.status(404).json({
        status: 'error',
        message: 'Chat not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete chat'
    });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role
// @access  Private (Admin)
router.put('/users/:id/role',
  authenticateUser,
  adminOnly,
  [
    body('role').isIn(['user', 'farmer', 'admin']).withMessage('Invalid role')
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

      const { role } = req.body;

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      res.json({
        status: 'success',
        message: 'User role updated successfully',
        data: user
      });
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update user role'
      });
    }
  }
);

// @route   GET /api/admin/analytics/export
// @desc    Export analytics data
// @access  Private (Admin)
router.get('/analytics/export', authenticateUser, adminOnly, async (req, res) => {
  try {
    const { type = 'all' } = req.query;

    let data = {};

    if (type === 'all' || type === 'users') {
      data.users = await User.find().select('-searchHistory');
    }

    if (type === 'all' || type === 'plants') {
      data.plants = await Plant.find().select('-plantIdResponse -groqResponse');
    }

    if (type === 'all' || type === 'chats') {
      data.chats = await Chat.find();
    }

    res.json({
      status: 'success',
      data: data,
      exportedAt: new Date().toISOString(),
      totalRecords: Object.values(data).reduce((sum, arr) => sum + arr.length, 0)
    });
  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to export analytics data'
    });
  }
});

// @route   PUT /api/admin/users/:id/block
// @desc    Block or unblock user
// @access  Private (Admin)
router.put('/users/:id/block',
  authenticateUser,
  adminOnly,
  [
    body('isBlocked').isBoolean().withMessage('isBlocked must be a boolean'),
    body('blockReason').optional().isString().withMessage('Block reason must be a string')
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

      const { isBlocked, blockReason } = req.body;
      const updateData = { isBlocked, blockReason: blockReason || '' };

      const user = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      res.json({
        status: 'success',
        message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
        data: user
      });
    } catch (error) {
      console.error('Block user error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to block user'
      });
    }
  }
);

// @route   PUT /api/admin/users/:id/suspend
// @desc    Suspend user temporarily
// @access  Private (Admin)
router.put('/users/:id/suspend',
  authenticateUser,
  adminOnly,
  [
    body('suspendedUntil').isISO8601().withMessage('Valid date is required'),
    body('blockReason').optional().isString().withMessage('Reason must be a string')
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

      const { suspendedUntil, blockReason } = req.body;

      const user = await User.findByIdAndUpdate(
        req.params.id,
        {
          suspendedUntil: new Date(suspendedUntil),
          blockReason: blockReason || '',
          isActive: false
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      res.json({
        status: 'success',
        message: 'User suspended successfully',
        data: user
      });
    } catch (error) {
      console.error('Suspend user error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to suspend user'
      });
    }
  }
);

// @route   GET /api/admin/users/:id/activity
// @desc    Get user's detailed activity
// @access  Private (Admin)
router.get('/users/:id/activity', authenticateUser, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-searchHistory');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get user's plants
    const userPlants = await Plant.find({ farmerId: user._id })
      .select('-plantIdResponse -groqResponse')
      .sort({ createdAt: -1 });

    // Get user's chats
    const userChats = await Chat.find({
      $or: [{ farmerId: user._id }, { userId: user._id }]
    })
      .populate('plantId', 'naturalName scientificName')
      .sort({ lastMessageAt: -1 });

    // Get search history
    const userWithHistory = await User.findById(req.params.id).select('searchHistory');

    res.json({
      status: 'success',
      data: {
        user,
        stats: {
          totalPlants: userPlants.length,
          totalChats: userChats.length,
          totalSearches: userWithHistory?.searchHistory?.length || 0,
          joinedDate: user.createdAt,
          lastLogin: user.lastLogin
        },
        plants: userPlants,
        chats: userChats,
        searchHistory: userWithHistory?.searchHistory || []
      }
    });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user activity'
    });
  }
});

module.exports = router;
