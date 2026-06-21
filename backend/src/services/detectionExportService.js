const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Detection = require('../models/Detection');
const NotificationDelivery = require('../models/NotificationDelivery');
require('../models/User');
const { calculateDistance } = require('./geocodingService');

const EXPORT_TIME_ZONE = 'Asia/Colombo';
const VALID_SCOPES = new Set(['all', 'selected', 'filtered', 'current', 'dateRange']);
const VALID_FORMATS = new Set(['xlsx', 'csv']);
const VALID_STATUSES = new Set(['all', 'active', 'cleared']);

const RESPONSE_LABELS = {
  protected: 'Protected',
  help_requested: 'Help Requested',
  cannot_protect: 'Cannot Protect',
  pending: 'Pending',
  no_response: 'No Response',
  attacked: 'Attacked',
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseDateOnly = (value, fieldName) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    const error = new Error(`${fieldName} must use YYYY-MM-DD format.`);
    error.statusCode = 400;
    throw error;
  }

  const validationDate = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(validationDate.getTime())
    || validationDate.toISOString().slice(0, 10) !== value
  ) {
    const error = new Error(`${fieldName} is invalid.`);
    error.statusCode = 400;
    throw error;
  }

  return new Date(`${value}T00:00:00.000+05:30`);
};

const parseObjectIds = (value, fieldName) => {
  const ids = String(value || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    const error = new Error(`${fieldName} is required.`);
    error.statusCode = 400;
    throw error;
  }

  if (ids.some((id) => !mongoose.isValidObjectId(id))) {
    const error = new Error(`${fieldName} contains an invalid detection ID.`);
    error.statusCode = 400;
    throw error;
  }

  return ids.map((id) => new mongoose.Types.ObjectId(id));
};

const buildDetectionQuery = ({ guardId, query }) => {
  const scope = query.scope || 'all';
  const format = query.format || 'xlsx';

  if (!VALID_SCOPES.has(scope)) {
    const error = new Error('Unsupported export range.');
    error.statusCode = 400;
    throw error;
  }

  if (!VALID_FORMATS.has(format)) {
    const error = new Error('Unsupported export format.');
    error.statusCode = 400;
    throw error;
  }

  const detectionQuery = { guardId };

  if (scope === 'selected') {
    detectionQuery._id = { $in: parseObjectIds(query.detectionIds, 'detectionIds') };
  }

  if (scope === 'current') {
    const [currentDetectionId] = parseObjectIds(query.currentDetectionId, 'currentDetectionId');
    detectionQuery._id = currentDetectionId;
  }

  if (scope === 'filtered') {
    const status = query.status || 'all';
    if (!VALID_STATUSES.has(status)) {
      const error = new Error('Unsupported detection status filter.');
      error.statusCode = 400;
      throw error;
    }

    if (status !== 'all') detectionQuery.status = status;
    if (query.search?.trim()) {
      detectionQuery.locationName = {
        $regex: escapeRegex(query.search.trim()),
        $options: 'i',
      };
    }
  }

  if (scope === 'dateRange') {
    const startDate = parseDateOnly(query.startDate, 'startDate');
    const endDate = parseDateOnly(query.endDate, 'endDate');

    if (startDate > endDate) {
      const error = new Error('Start date cannot be after end date.');
      error.statusCode = 400;
      throw error;
    }

    const exclusiveEndDate = new Date(endDate.getTime() + (24 * 60 * 60 * 1000));

    detectionQuery.detectedAt = {
      $gte: startDate,
      $lt: exclusiveEndDate,
    };

    if (query.location?.trim()) {
      detectionQuery.locationName = {
        $regex: escapeRegex(query.location.trim()),
        $options: 'i',
      };
    }
  }

  return { detectionQuery, scope, format };
};

const formatDateParts = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: 'Not available', time: 'Not available' };
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EXPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
};

const protectSpreadsheetText = (value, fallback = 'Not available') => {
  const text = value === null || value === undefined || value === ''
    ? fallback
    : String(value);

  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

const protectTextIdentifier = (value, fallback = 'Not available') => {
  const text = protectSpreadsheetText(value, fallback);
  return /^\d{11,}$/.test(text) ? `'${text}` : text;
};

const formatResponse = (delivery) => {
  const rawStatus = delivery.residentResponse?.status;
  if (!rawStatus) return 'No Response';
  return RESPONSE_LABELS[rawStatus]
    || protectSpreadsheetText(
      rawStatus
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase())
    );
};

const getResidentCoordinates = (delivery) => {
  const snapshotCoordinates = delivery.residentSnapshot?.location?.coordinates;
  const currentCoordinates = delivery.residentId?.areaLocation?.coordinates;
  const coordinates = snapshotCoordinates || currentCoordinates;

  return Array.isArray(coordinates) && coordinates.length === 2
    ? coordinates.map(Number)
    : null;
};

const getDistanceMeters = (detection, delivery) => {
  const rawStoredDistance = delivery.distanceToDetectionMeters;
  const storedDistance = Number(rawStoredDistance);
  if (
    rawStoredDistance !== null
    && rawStoredDistance !== undefined
    && rawStoredDistance !== ''
    && Number.isFinite(storedDistance)
    && storedDistance >= 0
  ) {
    return Math.round(storedDistance * 10) / 10;
  }

  const detectionCoordinates = detection.location?.coordinates;
  const residentCoordinates = getResidentCoordinates(delivery);

  if (
    !Array.isArray(detectionCoordinates)
    || detectionCoordinates.length !== 2
    || !residentCoordinates
  ) {
    return 'Not available';
  }

  const distance = calculateDistance(
    detectionCoordinates[1],
    detectionCoordinates[0],
    residentCoordinates[1],
    residentCoordinates[0]
  );

  return Number.isFinite(distance)
    ? Math.round(distance * 10) / 10
    : 'Not available';
};

const getResidentData = (delivery) => {
  const resident = delivery.residentId;
  const snapshot = delivery.residentSnapshot;

  return {
    name: protectSpreadsheetText(resident?.name || snapshot?.name),
    telegramChatId: protectTextIdentifier(
      resident?.telegramChatId
      || snapshot?.telegramChatId
      || delivery.telegramChatId
      || delivery.residentResponse?.telegramChatId
    ),
  };
};

const getCoordinates = (detection) => {
  const coordinates = detection.location?.coordinates;
  const longitude = Number(coordinates?.[0]);
  const latitude = Number(coordinates?.[1]);

  return {
    latitude: Number.isFinite(latitude) ? latitude : 'Not available',
    longitude: Number.isFinite(longitude) ? longitude : 'Not available',
  };
};

const createExportRows = (detections, deliveries) => {
  const deliveriesByDetection = new Map();

  deliveries.forEach((delivery) => {
    const detectionId = delivery.detectionId.toString();
    const existing = deliveriesByDetection.get(detectionId) || [];
    existing.push(delivery);
    deliveriesByDetection.set(detectionId, existing);
  });

  const detectionRows = [];
  const residentRows = [];
  const csvRows = [];

  detections.forEach((detection) => {
    const detectionId = detection._id.toString();
    const dateParts = formatDateParts(detection.detectedAt);
    const location = protectSpreadsheetText(detection.locationName);
    const coordinates = getCoordinates(detection);
    const linkedDeliveries = deliveriesByDetection.get(detectionId) || [];
    const affectedResidentCount = linkedDeliveries.length;

    const detectionRow = {
      'Detection ID': detectionId,
      'Detected Date': dateParts.date,
      'Detected Time': dateParts.time,
      Location: location,
      Latitude: coordinates.latitude,
      Longitude: coordinates.longitude,
      'Affected Resident Count': affectedResidentCount,
    };

    detectionRows.push(detectionRow);

    if (linkedDeliveries.length === 0) {
      csvRows.push({
        ...detectionRow,
        'Resident Name': '',
        'Telegram Chat ID': '',
        'Resident Response': '',
        'Distance From Elephant (m)': '',
      });
      return;
    }

    linkedDeliveries.forEach((delivery) => {
      const resident = getResidentData(delivery);
      const residentRow = {
        'Detection ID': detectionId,
        'Detected Date': dateParts.date,
        'Detected Time': dateParts.time,
        Location: location,
        'Resident Name': resident.name,
        'Telegram Chat ID': resident.telegramChatId,
        'Resident Response': formatResponse(delivery),
        'Distance From Elephant (m)': getDistanceMeters(detection, delivery),
      };

      residentRows.push(residentRow);
      csvRows.push({
        ...detectionRow,
        'Resident Name': residentRow['Resident Name'],
        'Telegram Chat ID': residentRow['Telegram Chat ID'],
        'Resident Response': residentRow['Resident Response'],
        'Distance From Elephant (m)': residentRow['Distance From Elephant (m)'],
      });
    });
  });

  return { detectionRows, residentRows, csvRows };
};

const applyWorksheetFormatting = (worksheet, widths) => {
  worksheet['!cols'] = widths.map((wch) => ({ wch }));

  if (!worksheet['!ref']) return;
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const address = XLSX.utils.encode_cell({ r: 0, c: column });
    if (worksheet[address]) {
      worksheet[address].s = { font: { bold: true } };
    }
  }
};

const createWorkbookBuffer = ({ detectionRows, residentRows }) => {
  const workbook = XLSX.utils.book_new();
  const detectionSheet = XLSX.utils.json_to_sheet(detectionRows);
  const residentSheet = XLSX.utils.json_to_sheet(residentRows, {
    header: [
      'Detection ID',
      'Detected Date',
      'Detected Time',
      'Location',
      'Resident Name',
      'Telegram Chat ID',
      'Resident Response',
      'Distance From Elephant (m)',
    ],
  });

  applyWorksheetFormatting(detectionSheet, [26, 14, 12, 32, 14, 14, 24]);
  applyWorksheetFormatting(residentSheet, [26, 14, 12, 32, 28, 24, 22, 28]);

  XLSX.utils.book_append_sheet(workbook, detectionSheet, 'Detections');
  XLSX.utils.book_append_sheet(workbook, residentSheet, 'Resident Outcomes');

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true,
  });
};

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return '';

  const text = typeof value === 'number'
    ? String(value)
    : protectSpreadsheetText(value, '');

  return `"${text.replace(/"/g, '""')}"`;
};

const createCsvBuffer = (rows) => {
  const headers = [
    'Detection ID',
    'Detected Date',
    'Detected Time',
    'Location',
    'Latitude',
    'Longitude',
    'Affected Resident Count',
    'Resident Name',
    'Telegram Chat ID',
    'Resident Response',
    'Distance From Elephant (m)',
  ];

  const lines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ];

  return Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8');
};

const getExportFilenameDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EXPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const generateDetectionExport = async ({ guardId, query }) => {
  const { detectionQuery, format } = buildDetectionQuery({ guardId, query });
  const detections = await Detection.find(detectionQuery)
    .sort({ detectedAt: -1 })
    .lean();

  if (detections.length === 0) {
    const error = new Error('No detection records match the selected export range.');
    error.statusCode = 404;
    throw error;
  }

  const detectionIds = detections.map((detection) => detection._id);
  const deliveries = await NotificationDelivery.find({
    guardId,
    detectionId: { $in: detectionIds },
  })
    .populate('residentId', 'name telegramChatId areaLocation')
    .sort({ detectionId: 1, createdAt: 1 })
    .lean();

  const rows = createExportRows(detections, deliveries);
  const date = getExportFilenameDate();

  if (format === 'csv') {
    return {
      buffer: createCsvBuffer(rows.csvRows),
      contentType: 'text/csv; charset=utf-8',
      filename: `lankabeacon-detections-${date}.csv`,
    };
  }

  return {
    buffer: createWorkbookBuffer(rows),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `lankabeacon-detections-${date}.xlsx`,
  };
};

module.exports = {
  generateDetectionExport,
  buildDetectionQuery,
  createExportRows,
  createCsvBuffer,
  createWorkbookBuffer,
};
