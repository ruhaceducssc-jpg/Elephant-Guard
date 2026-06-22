const test = require('node:test');
const assert = require('node:assert/strict');

const NotificationDelivery = require('../src/models/NotificationDelivery');
const { claimAutomaticDelivery } = require('../src/services/notificationService');

test('notification delivery schema has a unique detection and resident index', () => {
  const index = NotificationDelivery.schema.indexes().find(([keys]) => (
    keys.detectionId === 1 && keys.residentId === 1
  ));

  assert.ok(index);
  assert.equal(index[1].unique, true);
});

test('automatic delivery claim is atomic and excludes previously attempted records', async () => {
  const originalFindOneAndUpdate = NotificationDelivery.findOneAndUpdate;
  let capturedFilter;
  let capturedUpdate;

  NotificationDelivery.findOneAndUpdate = async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { _id: 'delivery-1', notificationStatus: 'retrying' };
  };

  try {
    const claimed = await claimAutomaticDelivery({
      _id: 'delivery-1',
      notificationStatus: 'pending',
      automaticAttemptedAt: null,
    });

    assert.ok(claimed);
    assert.equal(capturedFilter.notificationStatus, 'pending');
    assert.equal(capturedFilter.automaticAttemptedAt, null);
    assert.ok(capturedUpdate.$set.automaticAttemptedAt instanceof Date);
    assert.equal(capturedUpdate.$set.notificationStatus, 'retrying');
  } finally {
    NotificationDelivery.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('automatic delivery claim skips an already attempted delivery', async () => {
  const originalFindOneAndUpdate = NotificationDelivery.findOneAndUpdate;
  let called = false;

  NotificationDelivery.findOneAndUpdate = async () => {
    called = true;
    return null;
  };

  try {
    const claimed = await claimAutomaticDelivery({
      _id: 'delivery-1',
      notificationStatus: 'failed',
      automaticAttemptedAt: new Date(),
    });

    assert.equal(claimed, null);
    assert.equal(called, false);
  } finally {
    NotificationDelivery.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
