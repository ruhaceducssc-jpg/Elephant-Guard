/**
 * Normalizes an alert object for frontend and telegram consumption
 * @param {object} alert - The Mongoose alert document or object
 * @returns {object} - Normalized alert object
 */
const normalizeAlert = (alert) => {
  if (!alert) return null;
  
  const alertObj = typeof alert.toObject === 'function' ? alert.toObject() : alert;
  
  // Ensure we have coordinates even if nested in GeoJSON
  const longitude = alertObj.location?.coordinates ? alertObj.location.coordinates[0] : (alertObj.longitude || 0);
  const latitude = alertObj.location?.coordinates ? alertObj.location.coordinates[1] : (alertObj.latitude || 0);
  
  const locationName = alertObj.location?.locationName || alertObj.locationName || alertObj.areaName || 'Unknown Location';

  return {
    ...alertObj,
    id: alertObj._id || alertObj.id,
    _id: alertObj._id || alertObj.id,
    latitude,
    longitude,
    areaName: locationName,
    locationName: locationName,
    // Ensure nested fields are accessible
    confidence: alertObj.confidence || 0,
    alertStatus: alertObj.alertStatus || 'new',
    detectedAt: alertObj.detectedAt || alertObj.createdAt,
    image: alertObj.image || '',
  };
};

module.exports = {
  normalizeAlert
};
