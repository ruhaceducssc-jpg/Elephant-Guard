/**
 * Normalizes a detection object for frontend consumption
 * @param {object} detection - The Mongoose detection document or object
 * @returns {object} - Normalized detection object
 */
const normalizeDetection = (detection) => {
  if (!detection) return null;
  
  const detObj = typeof detection.toObject === 'function' ? detection.toObject() : detection;
  
  const longitude = detObj.location?.coordinates ? detObj.location.coordinates[0] : 0;
  const latitude = detObj.location?.coordinates ? detObj.location.coordinates[1] : 0;
  const locationName = detObj.locationName || 'Unknown Location';

  return {
    ...detObj,
    id: detObj._id.toString(),
    _id: detObj._id.toString(),
    latitude,
    longitude,
    locationName,
    confidence: detObj.confidence || 0,
    detectedAt: detObj.detectedAt || detObj.createdAt,
    image: detObj.imageUrl || detObj.image || '',
    status: detObj.status || 'active',
    clearedAt: detObj.clearedAt,
    clearedBy: detObj.clearedBy,
    clearedByGuardId: detObj.clearedByGuardId,
    clearReason: detObj.clearReason,
    statusHistory: detObj.statusHistory || []
  };
};

/**
 * Normalizes an alert object for frontend consumption
 */
const normalizeAlert = (alert) => {
  if (!alert) return null;
  const alertObj = typeof alert.toObject === 'function' ? alert.toObject() : alert;
  return {
    ...alertObj,
    id: alertObj._id.toString(),
    _id: alertObj._id.toString()
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
  
  // Basic validation for polygon points
  if (coords.length < 3) return false;

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

/**
 * Evaluates whether a resident is eligible for an alert
 */
const evaluateAlertEligibility = ({ elephantLocation, guardPatrolArea, resident }) => {
  const [lng, lat] = elephantLocation.coordinates;
  const { calculateDistance } = require('../services/geocodingService');

  // 1. Check Guard Patrol Area
  const insideGuardArea = isPointInPolygon([lng, lat], guardPatrolArea);
  
  if (!insideGuardArea) {
    return {
      insideGuardArea: false,
      insideResidentGeofence: false,
      eligible: false,
      reason: 'outside_guard_area'
    };
  }

  // 2. Check Resident Location
  if (!resident.areaLocation || !resident.areaLocation.coordinates) {
    return {
      insideGuardArea: true,
      insideResidentGeofence: false,
      eligible: false,
      reason: 'invalid_resident_location'
    };
  }

  const [resLng, resLat] = resident.areaLocation.coordinates;
  const radius = resident.geofenceRadiusMeters || 1000;
  
  const distance = calculateDistance(lat, lng, resLat, resLng);
  const insideResidentGeofence = distance <= radius;

  if (!insideResidentGeofence) {
    return {
      insideGuardArea: true,
      insideResidentGeofence: false,
      distanceToResidentMeters: Math.round(distance),
      residentRadiusMeters: radius,
      eligible: false,
      reason: 'outside_resident_geofence'
    };
  }

  // 3. Check Preferences
  if (resident.notificationEnabled === false) {
    return {
      insideGuardArea: true,
      insideResidentGeofence: true,
      distanceToResidentMeters: Math.round(distance),
      residentRadiusMeters: radius,
      eligible: false,
      reason: 'notifications_disabled'
    };
  }

  if (!resident.telegramChatId) {
    return {
      insideGuardArea: true,
      insideResidentGeofence: true,
      distanceToResidentMeters: Math.round(distance),
      residentRadiusMeters: radius,
      eligible: false,
      reason: 'missing_telegram_chat_id'
    };
  }

  return {
    insideGuardArea: true,
    insideResidentGeofence: true,
    distanceToResidentMeters: Math.round(distance),
    residentRadiusMeters: radius,
    eligible: true,
    reason: 'inside_both_areas'
  };
};

module.exports = {
  normalizeDetection,
  normalizeAlert,
  isPointInPolygon,
  evaluateAlertEligibility
};
