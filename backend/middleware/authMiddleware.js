const axios = require('axios');
const User = require('../models/User');

// Clerk authentication middleware
const authenticateUser = async (req, res, next) => {
  try {
    console.log('🔐 Authentication attempt:', {
      url: req.url,
      method: req.method,
      hasAuthHeader: !!req.headers.authorization,
      authHeader: req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'none'
    });

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No authorization header or invalid format');
      return res.status(401).json({
        status: 'error',
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('🔑 Token received:', token.substring(0, 20) + '...');

    // Verify Clerk JWT token
    try {
      let jsonPayload;

      // Try to decode JWT token
      try {
        const base64Url = token.split('.')[1];
        if (!base64Url) {
          throw new Error('Invalid JWT token format');
        }
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        jsonPayload = JSON.parse(Buffer.from(base64, 'base64').toString());
      } catch (decodeError) {
        console.error('❌ Token decode error:', decodeError.message);
        // For development, allow any token and extract basic info
        // TODO: Implement proper Clerk JWT verification in production
        const clerkId = token.substring(0, 20); // Use first 20 chars as temp ID
        const email = 'user@example.com';
        const firstName = 'User';
        const lastName = 'Test';
        const profileImage = '';

        console.log('⚠️ Using fallback authentication for development');

        // Find or create user
        let user = await User.findOne({ clerkId });

        if (!user) {
          user = await User.create({
            clerkId,
            email,
            firstName,
            lastName,
            role: 'consumer',
            profileImage: '',
            lastLogin: new Date()
          });
        } else {
          user.lastLogin = new Date();
          await user.save();
        }

        req.user = user;
        req.clerkUser = {
          id: clerkId,
          email_addresses: [{ email_address: email }],
          first_name: user.firstName,
          last_name: user.lastName,
          profile_image_url: user.profileImage
        };

        console.log('🎉 Fallback authentication successful for user:', user.email, 'role:', user.role);
        return next();
      }

      console.log('📋 Decoded token:', { userId: jsonPayload.sub, email: jsonPayload.email });
      console.log('📋 Full token payload:', JSON.stringify(jsonPayload, null, 2));

      const clerkId = jsonPayload.sub;

      // Fetch full user details from Clerk API
      let clerkUserData = { email: undefined, firstName: 'User', lastName: 'Test', profileImage: '' };

      try {
        // Try to fetch user details from Clerk API
        const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || '';
        if (CLERK_SECRET_KEY) {
          const clerkApiUrl = `https://api.clerk.com/v1/users/${clerkId}`;
          const clerkResponse = await axios.get(clerkApiUrl, {
            headers: {
              'Authorization': `Bearer ${CLERK_SECRET_KEY}`
            }
          });

          if (clerkResponse.data) {
            // Extract name from full name if last_name is not available
            let firstName = clerkResponse.data.first_name || 'User';
            let lastName = clerkResponse.data.last_name;

            if (!lastName && clerkResponse.data.username) {
              // If no last name, try to split username or use empty string
              lastName = '';
            }

            clerkUserData = {
              email: clerkResponse.data.email_addresses?.[0]?.email_address || `${clerkId}@temp.com`,
              firstName: firstName,
              lastName: lastName || '', // Use empty string instead of 'Test'
              profileImage: clerkResponse.data.image_url || clerkResponse.data.image_url || ''
            };
            console.log('✅ Fetched user details from Clerk:', clerkUserData);
          }
        }
      } catch (apiError) {
        console.log('⚠️ Could not fetch from Clerk API, using token data:', apiError.message);
      }

      const email = jsonPayload.email || clerkUserData.email || `${clerkId}@temp.com`;
      const firstName = jsonPayload.first_name || clerkUserData.firstName || jsonPayload.username || 'User';
      const lastName = jsonPayload.last_name || clerkUserData.lastName || ''; // Empty string instead of 'Test'
      const profileImage = jsonPayload.image_url || clerkUserData.profileImage || jsonPayload.picture || '';

      // Find or create user in MongoDB
      let user = await User.findOne({ clerkId });

      if (!user) {
        // Try to find by email as fallback
        user = await User.findOne({ email });

        if (!user) {
          console.log('🆕 Creating new user from Clerk...');
          user = await User.create({
            clerkId,
            email,
            firstName,
            lastName,
            role: 'consumer', // Default role
            profileImage,
            lastLogin: new Date()
          });
          console.log('✅ New user created:', user.email, 'role:', user.role);
        } else {
          // Update existing user with new clerkId
          user.clerkId = clerkId;
          user.firstName = firstName;
          user.lastName = lastName;
          user.profileImage = profileImage;
          user.lastLogin = new Date();
          await user.save();
          console.log('✅ Updated existing user with Clerk ID');
        }
      } else {
        // Update last login
        user.lastLogin = new Date();
        if (firstName && lastName) {
          user.firstName = firstName;
          user.lastName = lastName;
        }
        if (profileImage) user.profileImage = profileImage;
        await user.save();
        console.log('👤 User found:', user.email, 'role:', user.role);
      }

      // Attach user to request
      req.user = user;
      req.clerkUser = {
        id: clerkId,
        email_addresses: [{ email_address: email }],
        first_name: user.firstName,
        last_name: user.lastName,
        profile_image_url: user.profileImage
      };

      console.log('🎉 Authentication successful for user:', user.email, 'role:', user.role);
      next();

    } catch (tokenError) {
      console.error('❌ Token verification error:', tokenError.message);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token format'
      });
    }

  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    return res.status(401).json({
      status: 'error',
      message: 'Authentication failed'
    });
  }
};

// Role-based authorization middleware
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Admin only middleware
const adminOnly = authorizeRole('admin');

// Farmer only middleware
const farmerOnly = authorizeRole('farmer');

// Consumer or Farmer middleware
const consumerOrFarmer = authorizeRole('consumer', 'farmer');

// Farmer middleware that auto-upgrades consumers to farmers
const farmerOrAutoUpgrade = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required'
    });
  }

  // If user is already a farmer or admin, allow access
  if (req.user.role === 'farmer' || req.user.role === 'admin') {
    return next();
  }

  // If user is accessing farmer endpoints, auto-upgrade to farmer
  if (req.user.role === 'consumer') {
    req.user.role = 'farmer';
    await req.user.save();
    console.log(`Auto-upgraded user ${req.user.email} to farmer role`);
  }

  next();
};

// Check if user owns the resource
const checkOwnership = (resourceModel, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          status: 'error',
          message: 'Resource not found'
        });
      }

      // Admin can access any resource
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }

      // Check ownership based on resource type
      let isOwner = false;

      if (resourceModel.modelName === 'Plant') {
        isOwner = resource.farmerId.toString() === req.user._id.toString();
      } else if (resourceModel.modelName === 'Chat') {
        isOwner = resource.farmerId.toString() === req.user._id.toString() ||
          resource.userId.toString() === req.user._id.toString();
      } else if (resourceModel.modelName === 'User') {
        isOwner = resource._id.toString() === req.user._id.toString();
      }

      if (!isOwner) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You can only access your own resources.'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      console.error('Ownership check error:', error.message);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
  };
};

module.exports = {
  authenticateUser,
  authorizeRole,
  adminOnly,
  farmerOnly,
  consumerOrFarmer,
  farmerOrAutoUpgrade,
  checkOwnership
};
