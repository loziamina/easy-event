function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function parseEventDate(dateValue, timeValue) {
  if (!hasValue(dateValue)) return null;

  const date = String(dateValue).slice(0, 10);
  const time = hasValue(timeValue) ? String(timeValue).slice(0, 5) : '00:00';
  const parsed = new Date(`${date}T${time}:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateEventCreationInput(body = {}) {
  const errors = [];

  if (!hasValue(body.name)) errors.push('name is required');
  if (!hasValue(body.date)) errors.push('date is required');
  if (!hasValue(body.organizerId)) errors.push('organizerId is required');

  const parsedDate = parseEventDate(body.date, body.eventTime);
  if (hasValue(body.date) && !parsedDate) errors.push('date is invalid');

  if (hasValue(body.guestCount) && Number(body.guestCount) < 1) {
    errors.push('guestCount must be greater than 0');
  }

  if (hasValue(body.budget) && Number(body.budget) < 0) {
    errors.push('budget must be greater than or equal to 0');
  }

  return {
    ok: errors.length === 0,
    errors,
    parsedDate,
  };
}

function buildEventCreationPayload(body = {}, existing = {}) {
  const parsedDate = parseEventDate(body.date, body.eventTime) || existing.date;

  return {
    name: body.name != null ? String(body.name).trim() : existing.name,
    date: parsedDate,
    occasionType: body.occasionType != null ? String(body.occasionType) || null : existing.occasionType,
    theme: body.theme != null ? String(body.theme) || null : existing.theme,
    location: body.location != null ? String(body.location) || null : existing.location,
    guestCount: hasValue(body.guestCount) ? Number(body.guestCount) : existing.guestCount ?? null,
    budget: hasValue(body.budget) ? Number(body.budget) : existing.budget ?? null,
    notes: body.notes != null ? String(body.notes) || null : existing.notes,
    serviceBuffet: body.serviceBuffet !== undefined ? Boolean(body.serviceBuffet) : Boolean(existing.serviceBuffet),
    serviceDeco: body.serviceDeco !== undefined ? Boolean(body.serviceDeco) : Boolean(existing.serviceDeco),
    serviceOrganisation: body.serviceOrganisation !== undefined ? Boolean(body.serviceOrganisation) : Boolean(existing.serviceOrganisation),
    serviceGateaux: body.serviceGateaux !== undefined ? Boolean(body.serviceGateaux) : Boolean(existing.serviceGateaux),
    serviceMobilier: body.serviceMobilier !== undefined ? Boolean(body.serviceMobilier) : Boolean(existing.serviceMobilier),
    serviceAnimation: body.serviceAnimation !== undefined ? Boolean(body.serviceAnimation) : Boolean(existing.serviceAnimation),
    serviceLieu: body.serviceLieu !== undefined ? Boolean(body.serviceLieu) : Boolean(existing.serviceLieu),
  };
}

module.exports = {
  buildEventCreationPayload,
  parseEventDate,
  validateEventCreationInput,
};
