const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildEventCreationPayload,
  parseEventDate,
  validateEventCreationInput,
} = require('../../lib/eventCreationRules.cjs');

test('validateEventCreationInput accepts a valid event request', () => {
  const result = validateEventCreationInput({
    name: 'Anniversaire Sara',
    date: '2026-06-20',
    eventTime: '18:30',
    organizerId: 1,
    guestCount: 50,
    budget: 1200,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.parsedDate.getFullYear(), 2026);
  assert.equal(result.parsedDate.getMonth(), 5);
  assert.equal(result.parsedDate.getDate(), 20);
  assert.equal(result.parsedDate.getHours(), 18);
  assert.equal(result.parsedDate.getMinutes(), 30);
});

test('validateEventCreationInput rejects missing required fields', () => {
  const result = validateEventCreationInput({});

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    'name is required',
    'date is required',
    'organizerId is required',
  ]);
});

test('validateEventCreationInput rejects invalid numbers', () => {
  const result = validateEventCreationInput({
    name: 'Mariage',
    date: '2026-08-12',
    organizerId: 1,
    guestCount: 0,
    budget: -50,
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('guestCount must be greater than 0'));
  assert.ok(result.errors.includes('budget must be greater than or equal to 0'));
});

test('parseEventDate defaults to midnight when no time is provided', () => {
  const parsed = parseEventDate('2026-07-01');

  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 6);
  assert.equal(parsed.getDate(), 1);
  assert.equal(parsed.getHours(), 0);
  assert.equal(parsed.getMinutes(), 0);
});

test('buildEventCreationPayload normalizes event creation data', () => {
  const payload = buildEventCreationPayload({
    name: '  Baby shower  ',
    date: '2026-09-10',
    eventTime: '14:00',
    guestCount: '35',
    budget: '900.50',
    serviceDeco: true,
    serviceBuffet: false,
  });

  assert.equal(payload.name, 'Baby shower');
  assert.equal(payload.guestCount, 35);
  assert.equal(payload.budget, 900.5);
  assert.equal(payload.serviceDeco, true);
  assert.equal(payload.serviceBuffet, false);
});
