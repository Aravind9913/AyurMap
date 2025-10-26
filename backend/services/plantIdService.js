const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class PlantIdService {
  constructor() {
    this.apiKey = process.env.PLANT_ID_API_KEY;
    this.baseUrl = 'https://api.plant.id/v3';
  }

  async identifyPlant(imagePath) {
    try {
      if (!this.apiKey) {
        throw new Error('Plant.id API key not configured');
      }

      // Read image file and convert to base64
      const imageFile = fs.readFileSync(imagePath);
      const base64Image = imageFile.toString('base64');

      // Prepare payload with base64 image
      const payload = {
        images: [base64Image],
        similar_images: true,
      };

      // Call Plant.id API with comprehensive details
      const detailsParams = [
        'url', 'common_names', 'taxonomy', 'wiki_description',
        'edible_parts', 'propagation_methods', 'synonyms',
        'image', 'watering', 'gbif_id', 'inaturalist_id',
        'rank', 'description', 'language'
      ].join(',');

      const response = await axios.post(
        `${this.baseUrl}/identification?details=${detailsParams}&language=en`,
        payload,
        {
          headers: {
            'Api-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 30000
        }
      );

      // Check if we got results
      if (response.data && response.data.result && response.data.result.classification && response.data.result.classification.suggestions && response.data.result.classification.suggestions.length > 0) {
        const topSuggestion = response.data.result.classification.suggestions[0];
        const details = topSuggestion.details || {};

        return {
          success: true,
          data: {
            plantName: topSuggestion.name,
            scientificName: topSuggestion.name,
            commonNames: details.common_names || [],
            confidence: topSuggestion.probability,
            wikiDescription: details.description?.value || details.wiki_description?.value || '',
            taxonomy: details.taxonomy || {},
            url: details.url || '',
            similarImages: topSuggestion.similar_images || [],
            edibleParts: details.edible_parts || [],
            propagationMethods: details.propagation_methods || [],
            synonyms: details.synonyms || [],
            watering: details.watering || null,
            gbifId: details.gbif_id || null,
            inaturalistId: details.inaturalist_id || null,
            entityId: topSuggestion.id || null,
            wikipediaUrl: details.url || '',
            plantImage: details.image?.value || null,
            rank: details.rank || 'species',
            rawResponse: response.data
          }
        };
      } else {
        return {
          success: false,
          message: 'No plant identification results found',
          data: response.data
        };
      }
    } catch (error) {
      console.error('Plant.id API error:', error.message);

      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }

      return {
        success: false,
        message: error.response?.data?.message || error.message,
        error: error.response?.data || error.message
      };
    }
  }

  async getPlantDetails(plantId) {
    try {
      const response = await axios.get(`${this.baseUrl}/plants/${plantId}`, {
        headers: {
          'Api-Key': this.apiKey
        }
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Plant details API error:', error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async checkApiStatus() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        headers: {
          'Api-Key': this.apiKey
        }
      });

      return {
        success: true,
        status: 'healthy',
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        status: 'unhealthy',
        message: error.message
      };
    }
  }
}

module.exports = new PlantIdService();
