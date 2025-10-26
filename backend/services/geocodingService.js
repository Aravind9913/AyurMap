const NodeGeocoder = require('node-geocoder');

// Configure geocoder with OpenStreetMap provider (free, no API key needed)
const geocoder = NodeGeocoder({
    provider: 'openstreetmap',
    httpAdapter: 'https',
    formatter: null
});

/**
 * Reverse geocoding: Convert latitude and longitude to address details
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Object} Address details with country, state, city
 */
async function reverseGeocode(latitude, longitude) {
    try {
        console.log(`🗺️ Reverse geocoding for coordinates: ${latitude}, ${longitude}`);

        const results = await geocoder.reverse({ lat: latitude, lon: longitude });

        if (!results || results.length === 0) {
            console.warn('⚠️ No geocoding results found');
            return {
                success: false,
                message: 'Could not determine location from coordinates',
                data: null
            };
        }

        const result = results[0];

        console.log('📍 Geocoding result:', result);

        // Extract location details from the result
        const locationData = {
            country: result.country || '',
            state: result.administrativeLevels?.level1shortname || result.state || '',
            city: result.city || result.zipcode || '',
            address: result.formattedAddress || '',
            accuracy: null // Not provided by this service
        };

        console.log('✅ Extracted location data:', locationData);

        return {
            success: true,
            data: locationData
        };

    } catch (error) {
        console.error('❌ Reverse geocoding error:', error.message);

        return {
            success: false,
            message: 'Failed to geocode coordinates',
            error: error.message,
            data: null
        };
    }
}

/**
 * Forward geocoding: Convert city, state, country to latitude and longitude
 * @param {string} city - City name
 * @param {string} state - State or province name
 * @param {string} country - Country name
 * @returns {Object} Coordinates with latitude and longitude
 */
async function forwardGeocode(city, state, country) {
    try {
        // Build query from available location data
        const query = [city, state, country].filter(Boolean).join(', ');

        if (!query) {
            return {
                success: false,
                message: 'No location data provided',
                data: null
            };
        }

        console.log(`🗺️ Forward geocoding for: ${query}`);

        const results = await geocoder.geocode(query);

        if (!results || results.length === 0) {
            console.warn('⚠️ No geocoding results found');
            return {
                success: false,
                message: 'Location not found',
                data: null
            };
        }

        const result = results[0];

        console.log('📍 Geocoding result:', {
            latitude: result.latitude,
            longitude: result.longitude,
            formattedAddress: result.formattedAddress
        });

        return {
            success: true,
            data: {
                latitude: result.latitude,
                longitude: result.longitude,
                formattedAddress: result.formattedAddress || query
            }
        };

    } catch (error) {
        console.error('❌ Forward geocoding error:', error.message);

        return {
            success: false,
            message: 'Failed to geocode location',
            error: error.message,
            data: null
        };
    }
}

module.exports = {
    reverseGeocode,
    forwardGeocode
};

