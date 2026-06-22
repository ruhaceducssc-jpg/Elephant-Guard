const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateDistance } = require('../src/services/geocodingService');
const {
  PatrolAreaValidationError,
  canAttemptAutomaticDelivery,
  evaluateAlertEligibility,
  isPointInPolygon,
  isResidentOwnedByGuard,
  normalizePatrolArea,
} = require('../src/utils/alertUtils');

const square = {
  type: 'Polygon',
  coordinates: [[
    [80, 7],
    [81, 7],
    [81, 8],
    [80, 8],
    [80, 7],
  ]],
};

test('normalizes an open GeoJSON ring without changing point order', () => {
  const normalized = normalizePatrolArea({
    type: 'Polygon',
    coordinates: [[
      [80, 7],
      [81, 7],
      [81, 8],
      [80, 8],
    ]],
  });

  assert.deepEqual(normalized.coordinates[0], square.coordinates[0]);
});

test('rejects a self-intersecting patrol boundary', () => {
  assert.throws(
    () => normalizePatrolArea({
      type: 'Polygon',
      coordinates: [[
        [80, 7],
        [81, 8],
        [80, 8],
        [81, 7],
        [80, 7],
      ]],
    }),
    PatrolAreaValidationError
  );
});

test('detects points inside and outside a patrol polygon', () => {
  assert.equal(isPointInPolygon([80.5, 7.5], square), true);
  assert.equal(isPointInPolygon([82, 7.5], square), false);
});

test('counts a point on a patrol polygon edge as inside', () => {
  assert.equal(isPointInPolygon([80.5, 7], square), true);
  assert.equal(isPointInPolygon([80, 7], square), true);
});

test('uses resident geofence radius in meters and includes the exact radius edge', () => {
  const elephantLocation = {
    type: 'Point',
    coordinates: [80.5, 7.5],
  };
  const residentCoordinates = [80.51, 7.5];
  const exactDistanceMeters = calculateDistance(
    elephantLocation.coordinates[1],
    elephantLocation.coordinates[0],
    residentCoordinates[1],
    residentCoordinates[0]
  );

  const evaluation = evaluateAlertEligibility({
    elephantLocation,
    guardPatrolArea: square,
    resident: {
      areaLocation: {
        type: 'Point',
        coordinates: residentCoordinates,
      },
      geofenceRadiusMeters: exactDistanceMeters,
      telegramChatId: '12345',
      notificationEnabled: true,
    },
  });

  assert.equal(evaluation.insideGuardArea, true);
  assert.equal(evaluation.insideResidentGeofence, true);
  assert.equal(evaluation.eligible, true);
});

test('enforces the guard-boundary AND resident-geofence truth table', () => {
  const cases = [
    {
      name: 'inside guard and inside resident geofence',
      elephantCoordinates: [80.5, 7.5],
      residentCoordinates: [80.5, 7.5],
      radiusMeters: 100,
      expected: true,
    },
    {
      name: 'inside guard and outside resident geofence',
      elephantCoordinates: [80.5, 7.5],
      residentCoordinates: [80.9, 7.9],
      radiusMeters: 100,
      expected: false,
    },
    {
      name: 'outside guard and inside resident geofence',
      elephantCoordinates: [82, 9],
      residentCoordinates: [82, 9],
      radiusMeters: 100,
      expected: false,
    },
    {
      name: 'outside guard and outside resident geofence',
      elephantCoordinates: [82, 9],
      residentCoordinates: [83, 10],
      radiusMeters: 100,
      expected: false,
    },
  ];

  for (const testCase of cases) {
    const evaluation = evaluateAlertEligibility({
      elephantLocation: {
        type: 'Point',
        coordinates: testCase.elephantCoordinates,
      },
      guardPatrolArea: square,
      resident: {
        areaLocation: {
          type: 'Point',
          coordinates: testCase.residentCoordinates,
        },
        geofenceRadiusMeters: testCase.radiusMeters,
        telegramChatId: '12345',
        notificationEnabled: true,
      },
    });

    assert.equal(evaluation.eligible, testCase.expected, testCase.name);
  }
});

test('rejects invalid resident radii instead of applying a fallback radius', () => {
  const evaluation = evaluateAlertEligibility({
    elephantLocation: {
      type: 'Point',
      coordinates: [80.5, 7.5],
    },
    guardPatrolArea: square,
    resident: {
      areaLocation: {
        type: 'Point',
        coordinates: [80.5, 7.5],
      },
      geofenceRadiusMeters: 0,
      telegramChatId: '12345',
    },
  });

  assert.equal(evaluation.eligible, false);
  assert.equal(evaluation.reason, 'invalid_geofence_radius');
});

test('enforces resident ownership against the detection guard', () => {
  assert.equal(
    isResidentOwnedByGuard({ registeredBy: 'guard-a' }, 'guard-a'),
    true
  );
  assert.equal(
    isResidentOwnedByGuard({ registeredBy: 'guard-b' }, 'guard-a'),
    false
  );
});

test('prevents another automatic attempt after a delivery was attempted or sent', () => {
  assert.equal(canAttemptAutomaticDelivery({
    notificationStatus: 'pending',
    automaticAttemptedAt: null,
  }), true);
  assert.equal(canAttemptAutomaticDelivery({
    notificationStatus: 'failed',
    automaticAttemptedAt: new Date(),
  }), false);
  assert.equal(canAttemptAutomaticDelivery({
    notificationStatus: 'sent',
    automaticAttemptedAt: null,
  }), false);
});
