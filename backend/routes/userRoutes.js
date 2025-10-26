const express = require('express');
const { body, validationResult } = require('express-validator');

const Plant = require('../models/Plant');
const User = require('../models/User');
const Chat = require('../models/Chat');
const { authenticateUser, consumerOrFarmer } = require('../middleware/authMiddleware');
const groqService = require('../services/groqService');

const router = express.Router();

// @route   POST /api/user/sync-role
// @desc    Sync user role from frontend selection
// @access  Private (Authenticated)
router.post('/sync-role',
  authenticateUser,
  [
    body('role').isIn(['consumer', 'farmer']).withMessage('Role must be consumer or farmer')
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

      // Update user role
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { role },
        { new: true, runValidators: true }
      );

      console.log(`✅ Role synced for user ${updatedUser.email}: ${role}`);

      res.json({
        status: 'success',
        message: 'Role updated successfully',
        data: {
          id: updatedUser._id,
          email: updatedUser.email,
          role: updatedUser.role
        }
      });

    } catch (error) {
      console.error('Sync role error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to sync role'
      });
    }
  }
);

// @route   POST /api/user/search-plants
// @desc    Search for plants by condition or query
// @access  Private (User)
router.post('/search-plants',
  authenticateUser,
  consumerOrFarmer,
  [
    body('query').isLength({ min: 1 }).withMessage('Search query is required'),
    body('latitude').optional().isNumeric().withMessage('Latitude must be a number'),
    body('longitude').optional().isNumeric().withMessage('Longitude must be a number'),
    body('radius').optional().isNumeric().withMessage('Radius must be a number')
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

      const { query, latitude, longitude, radius = 50 } = req.body;

      // Save search to user's history
      const searchEntry = {
        query,
        timestamp: new Date(),
        results: []
      };

      let plants = [];

      // Check if query looks like a health condition
      const healthConditions = ['cold', 'fever', 'cough', 'headache', 'stomach', 'pain', 'inflammation', 'digestion', 'anxiety', 'stress'];
      const isHealthCondition = healthConditions.some(condition =>
        query.toLowerCase().includes(condition)
      );

      if (isHealthCondition) {
        // Use Groq AI to find plants for this condition
        console.log('Searching for plants using Groq AI...');
        const groqResult = await groqService.searchPlantsForCondition(query);

        if (groqResult.success && Array.isArray(groqResult.data)) {
          // Search for matching plants in database
          const plantNames = groqResult.data.map(plant => plant.plantName);

          plants = await Plant.find({
            $and: [
              { isActive: true },
              {
                $or: [
                  { naturalName: { $in: plantNames } },
                  { scientificName: { $in: plantNames } },
                  { commonNames: { $in: plantNames } }
                ]
              }
            ]
          }).select('-plantIdResponse -groqResponse -imagePath');
        }
      } else {
        // Regular text search
        plants = await Plant.find({
          $and: [
            { isActive: true },
            {
              $or: [
                { naturalName: { $regex: query, $options: 'i' } },
                { scientificName: { $regex: query, $options: 'i' } },
                { ayurvedicDescription: { $regex: query, $options: 'i' } },
                { medicinalBenefits: { $regex: query, $options: 'i' } },
                { commonNames: { $regex: query, $options: 'i' } },
                { family: { $regex: query, $options: 'i' } }
              ]
            }
          ]
        }).select('-plantIdResponse -groqResponse -imagePath');
      }

      // Filter by location if provided
      if (latitude && longitude) {
        const filteredPlants = plants.filter(plant => {
          const distance = calculateDistance(
            latitude, longitude,
            plant.location.latitude, plant.location.longitude
          );
          return distance <= radius;
        });

        // Sort by distance
        filteredPlants.sort((a, b) => {
          const distanceA = calculateDistance(
            latitude, longitude,
            a.location.latitude, a.location.longitude
          );
          const distanceB = calculateDistance(
            latitude, longitude,
            b.location.latitude, b.location.longitude
          );
          return distanceA - distanceB;
        });

        plants = filteredPlants;
      }

      // Update view count for found plants
      if (plants.length > 0) {
        const plantIds = plants.map(plant => plant._id);
        await Plant.updateMany(
          { _id: { $in: plantIds } },
          { $inc: { viewCount: 1 } }
        );
      }

      // Save search results to user's history
      searchEntry.results = plants.map(plant => ({
        plantId: plant._id,
        relevanceScore: 1.0 // Simple relevance scoring
      }));

      await User.findByIdAndUpdate(req.user._id, {
        $push: { searchHistory: searchEntry }
      });

      res.json({
        status: 'success',
        data: {
          query,
          results: plants,
          totalFound: plants.length,
          searchType: isHealthCondition ? 'condition' : 'text',
          aiSuggestions: isHealthCondition ? groqResult.data : null
        }
      });

    } catch (error) {
      console.error('Search plants error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to search plants'
      });
    }
  }
);

// @route   GET /api/user/plants-nearby
// @desc    Get plants within radius of user's location
// @access  Private (User)
router.get('/plants-nearby',
  authenticateUser,
  consumerOrFarmer,
  async (req, res) => {
    try {
      const { latitude, longitude, radius = 50 } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({
          status: 'error',
          message: 'Latitude and longitude are required'
        });
      }

      // Find plants with valid GPS coordinates OR with city/state info
      const allPlants = await Plant.find({
        isActive: true,
        $or: [
          // Plants with valid GPS coordinates
          {
            'location.latitude': {
              $gte: parseFloat(latitude) - (radius / 111),
              $lte: parseFloat(latitude) + (radius / 111)
            },
            'location.longitude': {
              $gte: parseFloat(longitude) - (radius / 111),
              $lte: parseFloat(longitude) + (radius / 111)
            }
          },
          // Plants without GPS (lat=0, lng=0) but with city/state info
          {
            'location.latitude': 0,
            'location.longitude': 0,
            'location.city': { $exists: true, $ne: '' }
          }
        ]
      }).select('-plantIdResponse -groqResponse -imagePath');

      console.log(`Found ${allPlants.length} plants for filtering`);

      // Calculate exact distances and filter
      const nearbyPlants = [];

      for (const plant of allPlants) {
        let plantLat = plant.location.latitude;
        let plantLng = plant.location.longitude;
        let distance = Infinity;

        // If plant has invalid GPS (0,0), try to geocode it
        if (plantLat === 0 && plantLng === 0) {
          if (plant.location.city) {
            try {
              const query = [plant.location.city, plant.location.state, plant.location.country]
                .filter(Boolean)
                .join(', ');

              console.log(`🌍 Geocoding plant: ${query}`);

              const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
                {
                  headers: { 'User-Agent': 'AyurMap/1.0' }
                }
              );

              const data = await response.json();
              if (data && data.length > 0) {
                plantLat = parseFloat(data[0].lat);
                plantLng = parseFloat(data[0].lon);
                console.log(`✅ Geocoded plant to: ${plantLat}, ${plantLng}`);

                // Update plant in database for future queries
                await Plant.findByIdAndUpdate(plant._id, {
                  'location.latitude': plantLat,
                  'location.longitude': plantLng
                });
              }
            } catch (error) {
              console.error(`❌ Geocoding failed for plant ${plant._id}:`, error);
            }
          }
        }

        // Only calculate distance if we have valid coordinates
        if (plantLat !== 0 && plantLng !== 0) {
          distance = calculateDistance(
            parseFloat(latitude), parseFloat(longitude),
            plantLat, plantLng
          );

          if (distance <= radius) {
            nearbyPlants.push({
              ...plant.toObject(),
              distance: Math.round(distance * 100) / 100
            });
          }
        }
      }

      // Sort by distance
      nearbyPlants.sort((a, b) => a.distance - b.distance);

      res.json({
        status: 'success',
        data: {
          plants: nearbyPlants,
          totalFound: nearbyPlants.length,
          center: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
          radius: parseInt(radius)
        }
      });

    } catch (error) {
      console.error('Get nearby plants error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch nearby plants'
      });
    }
  }
);

// @route   GET /api/user/plants/:id
// @desc    Get single plant details
// @access  Private (User)
router.get('/plants/:id', authenticateUser, consumerOrFarmer, async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id).select('-plantIdResponse -groqResponse -imagePath');

    if (!plant || !plant.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Plant not found'
      });
    }

    // Increment view count
    await Plant.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

    res.json({
      status: 'success',
      data: plant
    });
  } catch (error) {
    console.error('Get plant error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch plant'
    });
  }
});

// @route   GET /api/user/search-history
// @desc    Get user's search history
// @access  Private (User)
router.get('/search-history', authenticateUser, consumerOrFarmer, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('searchHistory');

    res.json({
      status: 'success',
      data: user.searchHistory || []
    });
  } catch (error) {
    console.error('Get search history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch search history'
    });
  }
});

// @route   DELETE /api/user/search-history
// @desc    Clear user's search history
// @access  Private (User)
router.delete('/search-history', authenticateUser, consumerOrFarmer, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $set: { searchHistory: [] } });

    res.json({
      status: 'success',
      message: 'Search history cleared successfully'
    });
  } catch (error) {
    console.error('Clear search history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear search history'
    });
  }
});

// @route   POST /api/user/start-chat
// @desc    Start a chat with farmer about a plant
// @access  Private (User)
router.post('/start-chat',
  authenticateUser,
  consumerOrFarmer,
  [
    body('plantId').isMongoId().withMessage('Valid plant ID is required')
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

      const { plantId } = req.body;

      // Check if plant exists
      const plant = await Plant.findById(plantId);
      if (!plant || !plant.isActive) {
        return res.status(404).json({
          status: 'error',
          message: 'Plant not found'
        });
      }

      // Check if chat already exists
      let chat = await Chat.findOne({
        plantId: plantId,
        userId: req.user._id
      });

      if (!chat) {
        // Create new chat
        chat = await Chat.create({
          plantId: plantId,
          farmerId: plant.farmerId,
          userId: req.user._id,
          farmerEmail: plant.farmerEmail,
          userEmail: req.user.email,
          plantName: plant.naturalName,
          participants: [
            {
              userId: plant.farmerId,
              email: plant.farmerEmail,
              name: plant.farmerName,
              role: 'farmer'
            },
            {
              userId: req.user._id,
              email: req.user.email,
              name: `${req.user.firstName} ${req.user.lastName}`,
              role: req.user.role
            }
          ]
        });
      }

      res.status(201).json({
        status: 'success',
        message: 'Chat started successfully',
        data: {
          chatId: chat._id,
          plant: {
            id: plant._id,
            name: plant.naturalName,
            scientificName: plant.scientificName,
            imageUrl: plant.imageUrl
          },
          farmer: {
            name: plant.farmerName,
            email: plant.farmerEmail,
            phone: plant.farmerPhone
          }
        }
      });

    } catch (error) {
      console.error('Start chat error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to start chat'
      });
    }
  }
);

// @route   GET /api/user/my-chats
// @desc    Get user's active chats
// @access  Private (User)
router.get('/my-chats', authenticateUser, consumerOrFarmer, async (req, res) => {
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
    console.error('Get my chats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch chats'
    });
  }
});

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private (User)
router.put('/profile',
  authenticateUser,
  consumerOrFarmer,
  [
    body('phoneNumber').optional().isMobilePhone().withMessage('Invalid phone number'),
    body('latitude').optional().isNumeric().withMessage('Latitude must be a number'),
    body('longitude').optional().isNumeric().withMessage('Longitude must be a number')
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

      const { phoneNumber, latitude, longitude, address, city, state, country } = req.body;

      const updateData = {};
      if (phoneNumber) updateData.phoneNumber = phoneNumber;
      if (latitude && longitude) {
        updateData.location = {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address: address || '',
          city: city || '',
          state: state || '',
          country: country || ''
        };
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        updateData,
        { new: true, runValidators: true }
      );

      res.json({
        status: 'success',
        message: 'Profile updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update profile'
      });
    }
  }
);

// @route   GET /api/user/popular-plants
// @desc    Get popular plant names for suggestions
// @access  Private (User)
router.get('/popular-plants', authenticateUser, consumerOrFarmer, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get the most viewed plants - prioritize naturalName (common name)
    const popularPlants = await Plant.find({
      isActive: true,
      naturalName: { $exists: true, $ne: '' } // Only plants with natural names
    })
      .select('naturalName commonNames')
      .sort({ viewCount: -1 })
      .limit(parseInt(limit));

    // Extract plant names - use naturalName (common name) first, then commonNames
    const plantNames = [];
    popularPlants.forEach(plant => {
      if (plant.naturalName && !plantNames.includes(plant.naturalName)) {
        plantNames.push(plant.naturalName);
      }
      // Add common names if naturalName isn't available
      if (plant.commonNames && Array.isArray(plant.commonNames)) {
        plant.commonNames.forEach(name => {
          if (name && !plantNames.includes(name)) {
            plantNames.push(name);
          }
        });
      }
    });

    res.json({
      status: 'success',
      data: {
        plants: plantNames.slice(0, parseInt(limit)) // Limit final results
      }
    });
  } catch (error) {
    console.error('Get popular plants error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch popular plants'
    });
  }
});

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

module.exports = router;
