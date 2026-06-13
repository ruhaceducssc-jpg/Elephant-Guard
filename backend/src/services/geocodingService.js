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
 * @param {number} latitude1 - Latitude point 1
 * @param {number} longitude1 - Longitude point 1
 * @param {number} latitude2 - Latitude point 2
 * @param {number} longitude2 - Longitude point 2
 * @returns {number|null} - Distance in meters
 */
const calculateDistance = (latitude1, longitude1, latitude2, longitude2) => {
  const values = [latitude1, longitude1, latitude2, longitude2].map(Number);

  if (!values.every(Number.isFinite)) {
    return null;
  }

  const [lat1, lon1, lat2, lon2] = values;

  const R = 6371e3; // Earth radius in meters
  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

module.exports = {
  getReadableLocation,
  calculateDistance
};
