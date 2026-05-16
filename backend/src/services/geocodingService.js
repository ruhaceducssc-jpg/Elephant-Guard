const axios = require('axios');

/**
 * Get readable location name from coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string>} - Human readable address
 */
const getReadableLocation = async (lat, lng) => {
  try {
    // Attempt using OpenStreetMap Nominatim
    const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`, {
      headers: { 'User-Agent': 'ElephantAlertSriLanka/1.0' },
      timeout: 5000
    });
    
    if (response.data && response.data.display_name) {
      const addr = response.data.address;
      // Build a friendly name: Village/Suburb, Town/City
      const main = addr.suburb || addr.village || addr.neighbourhood || addr.hamlet || addr.town || 'Unknown Area';
      const secondary = addr.city || addr.county || addr.state_district || '';
      return secondary ? `${main}, ${secondary}` : main;
    }
  } catch (err) {
    console.error('Reverse geocoding error:', err.message);
  }
  
  // Fallback to coordinates if geocoding fails
  return `Area near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
};

/**
 * Calculate distance between two points in meters using Haversine formula
 * @param {number} lat1 - Latitude point 1
 * @param {number} lon1 - Longitude point 1
 * @param {number} lat2 - Latitude point 2
 * @param {number} lon2 - Longitude point 2
 * @returns {number} - Distance in meters
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
          Math.cos(phi1) * Math.cos(phi2) *
          Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

module.exports = {
  getReadableLocation,
  calculateDistance
};
