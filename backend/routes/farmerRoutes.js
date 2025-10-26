const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');

const Plant = require('../models/Plant');
const User = require('../models/User');
const { authenticateUser, farmerOrAutoUpgrade, checkOwnership } = require('../middleware/authMiddleware');
const plantIdService = require('../services/plantIdService');
const groqService = require('../services/groqService');
const geocodingService = require('../services/geocodingService');

const router = express.Router();

// Configure multer for in-memory storage (to store in MongoDB)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// @route   POST /api/farmer/recognize-plant
// @desc    Recognize plant from image (no saving)
// @access  Private (authenticated users only)
router.post('/recognize-plant',
  authenticateUser,
  upload.single('plantImage'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'Plant image is required'
        });
      }

      console.log('🌱 Recognizing plant from image...');

      // Create temp directory if it doesn't exist
      const uploadPath = path.join(__dirname, '../uploads/plants');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      // Create temporary file from buffer for Plant.id API
      const tempFilePath = path.join(uploadPath, `temp-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`);
      fs.writeFileSync(tempFilePath, req.file.buffer);

      // Call Plant.id API with temp file
      const plantIdResult = await plantIdService.identifyPlant(tempFilePath);

      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      if (!plantIdResult.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Plant identification failed',
          details: plantIdResult.message
        });
      }

      const plantData = plantIdResult.data;

      // Convert image to base64 for storage
      const imageBase64 = req.file.buffer.toString('base64');

      // Generate medicinal/ayurvedic description using Groq
      let medicinalUses = '';
      try {
        console.log('🧬 Generating medicinal description...');
        const groqResult = await groqService.generateAyurvedicDescription(
          plantData.plantName,
          plantData.scientificName,
          plantData.wikiDescription
        );

        if (groqResult.success) {
          // Groq returns Markdown string directly
          medicinalUses = groqResult.data;
          console.log('✅ Medicinal uses generated (Markdown)');
        } else {
          console.log('❌ Groq API failed:', groqResult.message);
        }
      } catch (err) {
        console.error('⚠️ Groq API error:', err.message);
      }

      // Don't save automatically - just return the recognized data
      // User will click "Save" button to store in MongoDB
      res.json({
        status: 'success',
        message: 'Plant recognized successfully',
        data: {
          name: plantData.plantName,
          scientificName: plantData.scientificName,
          commonNames: plantData.commonNames || [],
          confidence: plantData.confidence,
          description: plantData.wikiDescription || '',
          medicinalUses: medicinalUses,
          taxonomy: plantData.taxonomy || {},
          edibleParts: plantData.edibleParts || [],
          propagationMethods: plantData.propagationMethods || [],
          synonyms: plantData.synonyms || [],
          watering: plantData.watering || null,
          gbifId: plantData.gbifId || null,
          inaturalistId: plantData.inaturalistId || null,
          wikipediaUrl: plantData.wikipediaUrl || '',
          similarImages: plantData.similarImages || [],
          entityId: plantData.entityId || null,
          rank: plantData.rank || 'species',
          plantImage: plantData.plantImage || null,
          // Send base64 image data
          imageBase64: imageBase64,
          imageContentType: req.file.mimetype,
          imageOriginalName: req.file.originalname
        }
      });

    } catch (error) {
      console.error('Recognize plant error:', error);

      res.status(500).json({
        status: 'error',
        message: 'Failed to recognize plant',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// @route   POST /api/farmer/save-plant
// @desc    Save recognized plant to database
// @access  Private (authenticated users only)
router.post('/save-plant',
  authenticateUser,
  async (req, res) => {
    try {
      const {
        name,
        scientificName,
        commonNames,
        description,
        medicinalUses,
        taxonomy,
        edibleParts,
        propagationMethods,
        synonyms,
        watering,
        gbifId,
        inaturalistId,
        wikipediaUrl,
        similarImages,
        entityId,
        rank,
        plantImage,
        imageBase64,
        imageContentType,
        imageOriginalName,
        phoneNumber,
        firstName,
        lastName,
        email
      } = req.body;

      if (!name || !scientificName) {
        return res.status(400).json({
          status: 'error',
          message: 'Plant name and scientific name are required'
        });
      }

      // Validate required fields from form
      if (!phoneNumber || !firstName || !email) {
        return res.status(400).json({
          status: 'error',
          message: 'Phone number, first name, and email are required'
        });
      }

      // Handle location data
      let locationData = {
        latitude: 0,
        longitude: 0,
        country: '',
        state: '',
        city: '',
        address: ''
      };

      const { latitude, longitude, country, state, city } = req.body.location || {};

      if (latitude && longitude) {
        // GPS coordinates provided - try to reverse geocode for country/state/city
        console.log('📍 Coordinates provided, attempting reverse geocoding...');
        locationData.latitude = parseFloat(latitude);
        locationData.longitude = parseFloat(longitude);

        const geocodeResult = await geocodingService.reverseGeocode(latitude, longitude);

        if (geocodeResult.success && geocodeResult.data) {
          locationData.country = geocodeResult.data.country || '';
          locationData.state = geocodeResult.data.state || '';
          locationData.city = geocodeResult.data.city || '';
          locationData.address = geocodeResult.data.address || '';
          console.log('✅ Successfully geocoded location');
        } else {
          console.warn('⚠️ Geocoding failed, using manual entry or defaults');
          // Fallback: use manual entry fields if provided, or keep empty
          locationData.country = country || '';
          locationData.state = state || '';
          locationData.city = city || '';
        }
      } else if (country && state && city) {
        // Manual location entry
        console.log('📍 Manual location entry provided');
        locationData.country = country;
        locationData.state = state;
        locationData.city = city;
        locationData.latitude = 0;
        locationData.longitude = 0;
      } else {
        console.warn('⚠️ No location data provided, using defaults');
      }

      // Use form data for farmer info (from Clerk)
      const plantRecord = {
        farmerId: req.user._id,
        farmerEmail: email || req.user.email,
        farmerName: lastName ? `${firstName} ${lastName}` : firstName,
        farmerPhone: phoneNumber,
        imageUrl: imageOriginalName || '',
        imagePath: '',
        imageBase64: imageBase64 || null,
        naturalName: name,
        scientificName: scientificName,
        ayurvedicDescription: description || '',
        medicinalBenefits: medicinalUses || '',
        commonNames: Array.isArray(commonNames) ? commonNames : (commonNames ? JSON.parse(commonNames) : []),
        taxonomy: typeof taxonomy === 'object' && taxonomy !== null ? taxonomy : (taxonomy ? JSON.parse(taxonomy) : {}),
        edibleParts: Array.isArray(edibleParts) ? edibleParts : (edibleParts ? JSON.parse(edibleParts) : []),
        propagationMethods: Array.isArray(propagationMethods) ? propagationMethods : (propagationMethods ? JSON.parse(propagationMethods) : []),
        synonyms: Array.isArray(synonyms) ? synonyms : (synonyms ? JSON.parse(synonyms) : []),
        watering: watering && typeof watering === 'object' ? watering : (watering ? JSON.parse(watering) : null),
        gbifId: gbifId || null,
        inaturalistId: inaturalistId || null,
        entityId: entityId || null,
        wikipediaUrl: wikipediaUrl || '',
        plantImage: plantImage || null,
        rank: rank || 'species',
        similarImages: Array.isArray(similarImages) ? similarImages : (similarImages ? JSON.parse(similarImages) : []),
        location: locationData
      };

      const savedPlant = await Plant.create(plantRecord);
      console.log('💾 Saved to database:', savedPlant._id);

      res.json({
        status: 'success',
        message: 'Plant saved successfully',
        data: savedPlant
      });

    } catch (error) {
      console.error('Save plant error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to save plant',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// @route   GET /api/farmer/test-auth
// @desc    Test authentication endpoint
// @access  Private (Farmer)
router.get('/test-auth', authenticateUser, farmerOrAutoUpgrade, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: 'Authentication working',
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Test auth error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test failed'
    });
  }
});

// @route   POST /api/farmer/upload-plant
// @desc    Upload plant image and get AI identification
// @access  Private (Farmer)
router.post('/upload-plant',
  authenticateUser,
  farmerOrAutoUpgrade,
  upload.single('plantImage'),
  [
    body('latitude').isFloat().withMessage('Latitude must be a valid number'),
    body('longitude').isFloat().withMessage('Longitude must be a valid number'),
    body('phoneNumber').optional().isMobilePhone().withMessage('Invalid phone number')
  ],
  async (req, res) => {
    try {
      // Log received data for debugging
      console.log('📤 Received upload data:', {
        hasFile: !!req.file,
        fileField: req.file ? req.file.fieldname : 'none',
        body: req.body,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        phoneNumber: req.body.phoneNumber
      });

      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('❌ Validation errors:', errors.array());
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'Plant image is required'
        });
      }

      const { latitude, longitude, phoneNumber, address, city, state, country } = req.body;

      // Identify plant using Plant.id API
      console.log('Identifying plant with Plant.id API...');
      const plantIdResult = await plantIdService.identifyPlant(req.file.path);

      if (!plantIdResult.success) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          status: 'error',
          message: 'Plant identification failed',
          details: plantIdResult.message
        });
      }

      const plantData = plantIdResult.data;

      // Create plant record with comprehensive Plant.id data
      const plantRecord = {
        farmerId: req.user._id,
        farmerEmail: req.user.email,
        farmerName: `${req.user.firstName} ${req.user.lastName}`,
        farmerPhone: phoneNumber || req.user.phoneNumber || '',
        imageUrl: `/uploads/plants/${req.file.filename}`,
        imagePath: req.file.path,
        naturalName: plantData.plantName,
        scientificName: plantData.scientificName,
        ayurvedicDescription: plantData.wikiDescription || 'Plant description from Wiki',
        medicinalBenefits: 'Medicinal benefits information',
        commonNames: plantData.commonNames || [],
        taxonomy: plantData.taxonomy || {},
        edibleParts: plantData.edibleParts || [],
        propagationMethods: plantData.propagationMethods || [],
        synonyms: plantData.synonyms || [],
        watering: plantData.watering || null,
        gbifId: plantData.gbifId || null,
        inaturalistId: plantData.inaturalistId || null,
        entityId: plantData.entityId || null,
        wikipediaUrl: plantData.wikipediaUrl || '',
        plantImage: plantData.plantImage || null,
        rank: plantData.rank || 'species',
        similarImages: plantData.similarImages || [],
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address: address || '',
          city: city || '',
          state: state || '',
          country: country || ''
        },
        plantIdResponse: plantData.rawResponse
      };

      const plant = await Plant.create(plantRecord);

      // Update user's role to farmer if not already
      if (req.user.role === 'user') {
        await User.findByIdAndUpdate(req.user._id, { role: 'farmer' });
      }

      res.status(201).json({
        status: 'success',
        message: 'Plant uploaded and identified successfully',
        data: {
          plant: plant,
          identification: {
            confidence: plantIdResult.data.confidence,
            plantName: plantData.plantName,
            scientificName: plantData.scientificName
          }
        }
      });

    } catch (error) {
      console.error('Upload plant error:', error);

      // Clean up uploaded file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to upload plant',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// @route   GET /api/farmer/plants/:id/image
// @desc    Get plant image by ID
// @access  Private (Farmer)
router.get('/plants/:id/image',
  authenticateUser,
  async (req, res) => {
    try {
      const plant = await Plant.findById(req.params.id);

      if (!plant || !plant.imageBase64) {
        return res.status(404).json({
          status: 'error',
          message: 'Image not found'
        });
      }

      // Verify ownership
      if (plant.farmerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied'
        });
      }

      // Convert base64 to buffer and send
      const imageBuffer = Buffer.from(plant.imageBase64, 'base64');
      res.contentType('image/jpeg');
      res.send(imageBuffer);
    } catch (error) {
      console.error('Get image error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch image'
      });
    }
  }
);

// @route   GET /api/farmer/my-plants
// @desc    Get all plants uploaded by the farmer
// @access  Private (Farmer)
router.get('/my-plants', authenticateUser, farmerOrAutoUpgrade, async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const plants = await Plant.find({ farmerId: req.user._id })
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-plantIdResponse -groqResponse'); // Exclude large API responses

    const total = await Plant.countDocuments({ farmerId: req.user._id });

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
    console.error('Get my plants error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch plants'
    });
  }
});

// @route   PUT /api/farmer/plants/:id
// @desc    Update plant information
// @access  Private (Farmer)
router.put('/plants/:id',
  authenticateUser,
  farmerOrAutoUpgrade,
  checkOwnership(Plant),
  [
    body('naturalName').optional().isLength({ min: 1 }).withMessage('Natural name cannot be empty'),
    body('scientificName').optional().isLength({ min: 1 }).withMessage('Scientific name cannot be empty'),
    body('ayurvedicDescription').optional().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('medicinalBenefits').optional().isLength({ min: 10 }).withMessage('Medicinal benefits must be at least 10 characters'),
    body('phoneNumber').optional().isMobilePhone().withMessage('Invalid phone number')
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

      const {
        naturalName,
        scientificName,
        ayurvedicDescription,
        medicinalBenefits,
        commonNames,
        family,
        habitat,
        floweringSeason,
        partsUsed,
        preparationMethods,
        phoneNumber
      } = req.body;

      const updateData = {};
      if (naturalName) updateData.naturalName = naturalName;
      if (scientificName) updateData.scientificName = scientificName;
      if (ayurvedicDescription) updateData.ayurvedicDescription = ayurvedicDescription;
      if (medicinalBenefits) updateData.medicinalBenefits = medicinalBenefits;
      if (commonNames) updateData.commonNames = commonNames;
      if (family) updateData.family = family;
      if (habitat) updateData.habitat = habitat;
      if (floweringSeason) updateData.floweringSeason = floweringSeason;
      if (partsUsed) updateData.partsUsed = partsUsed;
      if (preparationMethods) updateData.preparationMethods = preparationMethods;
      if (phoneNumber) updateData.farmerPhone = phoneNumber;

      const updatedPlant = await Plant.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      res.json({
        status: 'success',
        message: 'Plant updated successfully',
        data: updatedPlant
      });
    } catch (error) {
      console.error('Update plant error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update plant'
      });
    }
  }
);

// @route   DELETE /api/farmer/plants/:id
// @desc    Delete plant
// @access  Private (Farmer)
router.delete('/plants/:id',
  authenticateUser,
  farmerOrAutoUpgrade,
  checkOwnership(Plant),
  async (req, res) => {
    try {
      const plant = req.resource;

      // Delete the plant record (image is stored in document)
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
  }
);

// @route   GET /api/farmer/plants/:id
// @desc    Get single plant details
// @access  Private (Farmer)
router.get('/plants/:id',
  authenticateUser,
  farmerOrAutoUpgrade,
  checkOwnership(Plant),
  async (req, res) => {
    try {
      res.json({
        status: 'success',
        data: req.resource
      });
    } catch (error) {
      console.error('Get plant error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch plant'
      });
    }
  }
);

// @route   GET /api/farmer/profile
// @desc    Get farmer profile
// @access  Private (Farmer)
router.get('/profile', authenticateUser, farmerOrAutoUpgrade, async (req, res) => {
  try {
    const plantCount = await Plant.countDocuments({ farmerId: req.user._id });
    const totalViews = await Plant.aggregate([
      { $match: { farmerId: req.user._id } },
      { $group: { _id: null, totalViews: { $sum: '$viewCount' } } }
    ]);

    res.json({
      status: 'success',
      data: {
        user: req.user,
        stats: {
          totalPlants: plantCount,
          totalViews: totalViews[0]?.totalViews || 0
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch profile'
    });
  }
});

module.exports = router;
