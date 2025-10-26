const mongoose = require('mongoose');

const plantSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  farmerEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  farmerName: {
    type: String,
    required: false,
    default: 'Anonymous'
  },
  farmerPhone: {
    type: String,
    default: ''
  },

  // Plant identification data
  imageUrl: {
    type: String,
    required: false
  },
  imagePath: {
    type: String,
    required: false
  },
  // Base64 image data
  imageBase64: {
    type: String,
    required: false
  },

  // AI-generated plant details
  naturalName: {
    type: String,
    required: true
  },
  scientificName: {
    type: String,
    required: true
  },
  ayurvedicDescription: {
    type: String,
    required: false
  },
  medicinalBenefits: {
    type: String,
    required: false
  },

  // Additional plant information from Plant.id API
  commonNames: [String],
  family: String,
  habitat: String,
  floweringSeason: String,
  partsUsed: [String],
  preparationMethods: [String],

  // Comprehensive Plant.id API data
  taxonomy: {
    kingdom: String,
    phylum: String,
    class: String,
    order: String,
    family: String,
    genus: String
  },
  edibleParts: [String],
  propagationMethods: [String],
  synonyms: [String],
  watering: {
    min: Number,
    max: Number
  },
  gbifId: Number,
  inaturalistId: Number,
  entityId: String,
  wikipediaUrl: String,
  plantImage: String,
  rank: String,
  similarImages: [{
    url: String,
    url_small: String,
    similarity: Number,
    citation: String,
    license_name: String,
    license_url: String
  }],

  // Location data
  location: {
    latitude: {
      type: Number,
      required: false,
      default: 0
    },
    longitude: {
      type: Number,
      required: false,
      default: 0
    },
    address: String,
    city: String,
    state: String,
    country: String,
    accuracy: Number
  },

  // Plant status and verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationNotes: String,
  isActive: {
    type: Boolean,
    default: true
  },

  // Analytics
  viewCount: {
    type: Number,
    default: 0
  },
  chatCount: {
    type: Number,
    default: 0
  },

  // Plant ID API response (for debugging)
  plantIdResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // Groq AI response (for debugging)
  groqResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
plantSchema.index({ farmerId: 1 });
plantSchema.index({ farmerEmail: 1 });
plantSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
plantSchema.index({ naturalName: 'text', scientificName: 'text', ayurvedicDescription: 'text' });
plantSchema.index({ isActive: 1, isVerified: 1 });
plantSchema.index({ createdAt: -1 });

// Geospatial index for location-based queries
plantSchema.index({ 'location.latitude': 1, 'location.longitude': 1 }, {
  name: 'location_2dsphere',
  background: true
});

module.exports = mongoose.model('Plant', plantSchema);
