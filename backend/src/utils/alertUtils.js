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
    insidePatrolArea: alertObj.insidePatrolArea || false,
    alertStatus: alertObj.alertStatus || 'new',
    detectedAt: alertObj.detectedAt || alertObj.createdAt,
    image: alertObj.image || '',
  };
};

/**
 * Checks if a point [lng, lat] is inside a polygon GeoJSON
 * @param {Array} point - [longitude, latitude]
 * @param {Object} polygon - GeoJSON Polygon object or coordinates
 * @returns {Boolean}
 */
const isPointInPolygon = (point, polygon) => {
  if (!polygon || !polygon.coordinates || polygon.coordinates.length === 0) return false;
  
  const x = point[0];
  const y = point[1];
  
  // Use the first linear ring (exterior)
  const coords = polygon.coordinates[0];
  
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0], yi = coords[i][1];
    const xj = coords[j][0], yj = coords[j][1];
    
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
};

module.exports = {
  normalizeAlert,
  isPointInPolygon
};
