const { calculateDistance } = require('../services/geocodingService');

const GEOMETRY_EPSILON = 1e-10;

class PatrolAreaValidationError extends Error {
  constructor(message, code = 'invalid_guard_boundary') {
    super(message);
    this.name = 'PatrolAreaValidationError';
    this.code = code;
  }
}

const isValidLongitude = (value) => Number.isFinite(Number(value))
  && Number(value) >= -180
  && Number(value) <= 180;

const isValidLatitude = (value) => Number.isFinite(Number(value))
  && Number(value) >= -90
  && Number(value) <= 90;

const isValidCoordinatePair = (coordinate) => Array.isArray(coordinate)
  && coordinate.length === 2
  && isValidLongitude(coordinate[0])
  && isValidLatitude(coordinate[1]);

const coordinatesEqual = (first, second) => (
  Math.abs(first[0] - second[0]) <= GEOMETRY_EPSILON
  && Math.abs(first[1] - second[1]) <= GEOMETRY_EPSILON
);

const orientation = (a, b, c) => {
  const value = ((b[1] - a[1]) * (c[0] - b[0]))
    - ((b[0] - a[0]) * (c[1] - b[1]));

  if (Math.abs(value) <= GEOMETRY_EPSILON) return 0;
  return value > 0 ? 1 : 2;
};

const isPointOnSegment = (point, start, end) => {
  const crossProduct = ((point[1] - start[1]) * (end[0] - start[0]))
    - ((point[0] - start[0]) * (end[1] - start[1]));

  if (Math.abs(crossProduct) > GEOMETRY_EPSILON) return false;

  return point[0] <= Math.max(start[0], end[0]) + GEOMETRY_EPSILON
    && point[0] >= Math.min(start[0], end[0]) - GEOMETRY_EPSILON
    && point[1] <= Math.max(start[1], end[1]) + GEOMETRY_EPSILON
    && point[1] >= Math.min(start[1], end[1]) - GEOMETRY_EPSILON;
};

const segmentsIntersect = (firstStart, firstEnd, secondStart, secondEnd) => {
  const o1 = orientation(firstStart, firstEnd, secondStart);
  const o2 = orientation(firstStart, firstEnd, secondEnd);
  const o3 = orientation(secondStart, secondEnd, firstStart);
  const o4 = orientation(secondStart, secondEnd, firstEnd);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && isPointOnSegment(secondStart, firstStart, firstEnd)) return true;
  if (o2 === 0 && isPointOnSegment(secondEnd, firstStart, firstEnd)) return true;
  if (o3 === 0 && isPointOnSegment(firstStart, secondStart, secondEnd)) return true;
  if (o4 === 0 && isPointOnSegment(firstEnd, secondStart, secondEnd)) return true;
  return false;
};

const hasSelfIntersections = (closedRing) => {
  const segmentCount = closedRing.length - 1;

  for (let firstIndex = 0; firstIndex < segmentCount; firstIndex += 1) {
    const firstStart = closedRing[firstIndex];
    const firstEnd = closedRing[firstIndex + 1];

    for (let secondIndex = firstIndex + 1; secondIndex < segmentCount; secondIndex += 1) {
      const segmentsAreAdjacent = Math.abs(firstIndex - secondIndex) === 1
        || (firstIndex === 0 && secondIndex === segmentCount - 1);

      if (segmentsAreAdjacent) continue;

      const secondStart = closedRing[secondIndex];
      const secondEnd = closedRing[secondIndex + 1];

      if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
        return true;
      }
    }
  }

  return false;
};

const getSignedRingArea = (closedRing) => {
  let area = 0;

  for (let index = 0; index < closedRing.length - 1; index += 1) {
    const current = closedRing[index];
    const next = closedRing[index + 1];
    area += (current[0] * next[1]) - (next[0] * current[1]);
  }

  return area / 2;
};

const normalizePatrolArea = (patrolArea) => {
  if (
    !patrolArea
    || patrolArea.type !== 'Polygon'
    || !Array.isArray(patrolArea.coordinates)
    || !Array.isArray(patrolArea.coordinates[0])
  ) {
    throw new PatrolAreaValidationError('Please provide a valid GeoJSON Polygon');
  }

  if (patrolArea.coordinates.length !== 1) {
    throw new PatrolAreaValidationError('Patrol boundaries must contain one exterior ring');
  }

  const ring = patrolArea.coordinates[0].map((coordinate) => {
    if (!isValidCoordinatePair(coordinate)) {
      throw new PatrolAreaValidationError(
        `Invalid patrol boundary coordinate: ${JSON.stringify(coordinate)}`
      );
    }

    return [Number(coordinate[0]), Number(coordinate[1])];
  });

  if (ring.length < 3) {
    throw new PatrolAreaValidationError('A patrol boundary requires at least three points');
  }

  const closedRing = [...ring];
  if (!coordinatesEqual(closedRing[0], closedRing[closedRing.length - 1])) {
    closedRing.push([...closedRing[0]]);
  }

  const vertices = closedRing.slice(0, -1);
  if (vertices.length < 3) {
    throw new PatrolAreaValidationError('A patrol boundary requires at least three unique points');
  }

  const uniqueVertices = new Set(vertices.map(([longitude, latitude]) => (
    `${longitude.toFixed(12)}:${latitude.toFixed(12)}`
  )));

  if (uniqueVertices.size !== vertices.length) {
    throw new PatrolAreaValidationError(
      'Patrol boundary points must be unique except for the closing coordinate'
    );
  }

  if (Math.abs(getSignedRingArea(closedRing)) <= GEOMETRY_EPSILON) {
    throw new PatrolAreaValidationError('Patrol boundary points must form a non-zero area');
  }

  if (hasSelfIntersections(closedRing)) {
    throw new PatrolAreaValidationError('Patrol boundary cannot self-intersect');
  }

  return {
    type: 'Polygon',
    coordinates: [closedRing],
  };
};

const isPointInPolygon = (point, polygon) => {
  if (!isValidCoordinatePair(point)) return false;

  let normalizedPolygon;
  try {
    normalizedPolygon = normalizePatrolArea(polygon);
  } catch {
    return false;
  }

  const [x, y] = point.map(Number);
  const ring = normalizedPolygon.coordinates[0];
  let inside = false;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const start = ring[index];
    const end = ring[index + 1];

    if (isPointOnSegment([x, y], start, end)) {
      return true;
    }

    const intersectsLatitude = (start[1] > y) !== (end[1] > y);
    if (!intersectsLatitude) continue;

    const intersectionLongitude = (
      ((end[0] - start[0]) * (y - start[1])) / (end[1] - start[1])
    ) + start[0];

    if (x < intersectionLongitude) {
      inside = !inside;
    }
  }

  return inside;
};

const isResidentOwnedByGuard = (resident, guardId) => {
  if (!resident?.registeredBy || !guardId) return false;
  return String(resident.registeredBy?._id || resident.registeredBy) === String(guardId);
};

const canAttemptAutomaticDelivery = (delivery) => Boolean(
  delivery
  && delivery.notificationStatus !== 'sent'
  && !delivery.automaticAttemptedAt
);

/**
 * Normalizes a detection object for frontend consumption.
 */
const normalizeDetection = (detection) => {
  if (!detection) return null;

  const detObj = typeof detection.toObject === 'function' ? detection.toObject() : detection;
  const longitude = detObj.location?.coordinates?.[0];
  const latitude = detObj.location?.coordinates?.[1];
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
    statusHistory: detObj.statusHistory || [],
  };
};

const normalizeAlert = (alert) => {
  if (!alert) return null;
  const alertObj = typeof alert.toObject === 'function' ? alert.toObject() : alert;
  return {
    ...alertObj,
    id: alertObj._id.toString(),
    _id: alertObj._id.toString(),
  };
};

const evaluateAlertEligibility = ({ elephantLocation, guardPatrolArea, resident }) => {
  const elephantCoordinates = elephantLocation?.coordinates;

  if (!isValidCoordinatePair(elephantCoordinates)) {
    return {
      insideGuardArea: false,
      insideResidentGeofence: false,
      eligible: false,
      reason: 'invalid_detection_location',
    };
  }

  let normalizedPatrolArea;
  try {
    normalizedPatrolArea = normalizePatrolArea(guardPatrolArea);
  } catch {
    return {
      insideGuardArea: false,
      insideResidentGeofence: false,
      eligible: false,
      reason: 'invalid_guard_boundary',
    };
  }

  const [longitude, latitude] = elephantCoordinates.map(Number);
  const insideGuardArea = isPointInPolygon(
    [longitude, latitude],
    normalizedPatrolArea
  );

  if (!insideGuardArea) {
    return {
      insideGuardArea: false,
      insideResidentGeofence: false,
      eligible: false,
      reason: 'outside_guard_boundary',
    };
  }

  const residentCoordinates = resident?.areaLocation?.coordinates;
  if (!isValidCoordinatePair(residentCoordinates)) {
    return {
      insideGuardArea: true,
      insideResidentGeofence: false,
      eligible: false,
      reason: 'invalid_resident_location',
    };
  }

  const radiusMeters = Number(resident.geofenceRadiusMeters);
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    return {
      insideGuardArea: true,
      insideResidentGeofence: false,
      eligible: false,
      reason: 'invalid_geofence_radius',
    };
  }

  const [residentLongitude, residentLatitude] = residentCoordinates.map(Number);
  const distanceMeters = calculateDistance(
    latitude,
    longitude,
    residentLatitude,
    residentLongitude
  );

  if (!Number.isFinite(distanceMeters)) {
    return {
      insideGuardArea: true,
      insideResidentGeofence: false,
      eligible: false,
      reason: 'invalid_resident_location',
    };
  }

  const insideResidentGeofence = distanceMeters <= radiusMeters;
  const commonResult = {
    insideGuardArea: true,
    insideResidentGeofence,
    distanceToResidentMeters: Math.round(distanceMeters),
    residentRadiusMeters: radiusMeters,
  };

  if (!insideResidentGeofence) {
    return {
      ...commonResult,
      eligible: false,
      reason: 'outside_resident_geofence',
    };
  }

  if (resident.notificationEnabled === false) {
    return {
      ...commonResult,
      eligible: false,
      reason: 'notifications_disabled',
    };
  }

  if (!String(resident.telegramChatId || '').trim()) {
    return {
      ...commonResult,
      eligible: false,
      reason: 'telegram_chat_id_missing',
    };
  }

  return {
    ...commonResult,
    eligible: true,
    reason: 'inside_both_areas',
  };
};

module.exports = {
  PatrolAreaValidationError,
  canAttemptAutomaticDelivery,
  evaluateAlertEligibility,
  isPointInPolygon,
  isResidentOwnedByGuard,
  isValidCoordinatePair,
  isValidLatitude,
  isValidLongitude,
  normalizeAlert,
  normalizeDetection,
  normalizePatrolArea,
};
