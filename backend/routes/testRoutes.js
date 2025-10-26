const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const plantIdService = require('../services/plantIdService');
const groqService = require('../services/groqService');

const router = express.Router();

// Configure multer for testing
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/plants');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `test-plant-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Test route for plant recognition (NO AUTH REQUIRED)
router.post('/test-plant-recognition', upload.single('plantImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Plant image is required'
      });
    }

    console.log('🧪 Testing plant recognition...');
    console.log('📁 File uploaded:', req.file.filename);

    // Test Plant.id API
    console.log('🔍 Identifying plant with Plant.id API...');
    const plantIdResult = await plantIdService.identifyPlant(req.file.path);

    if (!plantIdResult.success) {
      // Clean up file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        status: 'error',
        message: 'Plant identification failed',
        details: plantIdResult.message
      });
    }

    console.log('✅ Plant identified:', plantIdResult.data.plantName);

    // Test Groq AI
    console.log('🤖 Generating Ayurvedic description with Groq API...');
    const groqResult = await groqService.generateAyurvedicDescription(
      plantIdResult.data.plantName,
      plantIdResult.data.scientificName,
      plantIdResult.data.wikiDescription
    );

    console.log('✅ AI description generated:', groqResult.success);

    // Clean up test file
    fs.unlinkSync(req.file.path);

    res.json({
      status: 'success',
      message: 'Plant recognition test completed successfully!',
      data: {
        plantIdentification: {
          success: plantIdResult.success,
          plantName: plantIdResult.data.plantName,
          scientificName: plantIdResult.data.scientificName,
          confidence: plantIdResult.data.confidence,
          commonNames: plantIdResult.data.commonNames
        },
        aiDescription: {
          success: groqResult.success,
          ayurvedicDescription: groqResult.success ? groqResult.data.ayurvedicDescription : 'Failed to generate',
          medicinalBenefits: groqResult.success ? groqResult.data.medicinalBenefits : 'Failed to generate'
        },
        testResults: {
          plantIdApiWorking: plantIdResult.success,
          groqApiWorking: groqResult.success,
          overallSuccess: plantIdResult.success && groqResult.success
        }
      }
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    
    // Clean up file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      status: 'error',
      message: 'Test failed',
      error: error.message
    });
  }
});

module.exports = router;
