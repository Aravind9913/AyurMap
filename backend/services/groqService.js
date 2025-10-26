const axios = require('axios');

class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.baseUrl = 'https://api.groq.com/openai/v1';
  }

  async generateAyurvedicDescription(plantName, scientificName, wikiDescription = '') {
    try {
      if (!this.apiKey) {
        throw new Error('Groq API key not configured');
      }

      const systemPrompt = `
You are an expert Ayurvedic practitioner.

Return ONLY pure Markdown. No JSON. 
No explanations or commentary outside the markdown body.

The markdown must follow this exact structure:

## Medicinal Uses
(detailed Ayurvedic medicinal uses only)

### Preparation Methods
(common preparation forms and steps to prepare them)

### Dosage
(general traditionally recommended dosage)

### Precautions
(warnings and contraindications)

Rules:
- Only medicinal/therapeutic usage content.
- No taxonomy, no habitat, no history, no cultural notes.
- No citations or references.
- No extra headings or trailing commentary.
- No greeting or summary.
`;

      const userPrompt = `Provide Ayurvedic medicinal usage for "${plantName}" (Scientific name: ${scientificName}). 
${wikiDescription ? `Basic info: ${wikiDescription}` : ''}`;

      const response = await axios.post(`${this.baseUrl}/chat/completions`, {
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        top_p: 1,
        stream: false
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data?.choices?.length > 0) {
        const content = response.data.choices[0].message.content;
        return {
          success: true,
          data: content // direct markdown
        };
      }

      return {
        success: false,
        message: 'No response generated from Groq API'
      };

    } catch (error) {
      console.error('Groq API error:', error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message,
        error: error.response?.data || error.message
      };
    }
  }

  async searchPlantsForCondition(condition) {
    try {
      const prompt = `You are an expert Ayurvedic practitioner.
Provide a JSON array of plants used for the condition "${condition}". Each object must contain:
plantName, scientificName, howItHelps, partsUsed, preparationMethod, precautions.
No extra text.`;

      const response = await axios.post(`${this.baseUrl}/chat/completions`, {
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON array.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 1,
        stream: false
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data?.choices?.length > 0) {
        const content = response.data.choices[0].message.content;
        try {
          return {
            success: true,
            data: JSON.parse(content)
          };
        } catch {
          return {
            success: false,
            message: 'Invalid JSON response',
            rawResponse: content
          };
        }
      }

      return { success: false, message: 'No response from API' };

    } catch (error) {
      console.error('Groq search API error:', error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  async checkApiStatus() {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return {
        success: true,
        status: 'healthy',
        models: response.data.data
      };
    } catch (error) {
      return { success: false, status: 'unhealthy', message: error.message };
    }
  }
}

module.exports = new GroqService();
