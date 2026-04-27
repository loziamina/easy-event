export function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dayRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function eventRange(event) {
  const start = new Date(event.date);
  const end = new Date(start);
  end.setHours(end.getHours() + 8);
  return { start, end };
}

export function detectPlanningConflicts(events, blocks) {
  return events.map((event) => {
    const range = eventRange(event);
    const sameDayEvents = events.filter((other) => {
      if (other.id === event.id) return false;
      const otherRange = eventRange(other);
      return rangesOverlap(range.start, range.end, otherRange.start, otherRange.end);
    });
    const blockingSlots = blocks.filter((block) => (
      block.eventId !== event.id &&
      rangesOverlap(range.start, range.end, new Date(block.startAt), new Date(block.endAt))
    ));

    return {
      eventId: event.id,
      hasConflict: sameDayEvents.length > 0 || blockingSlots.length > 0,
      sameDayEvents: sameDayEvents.map((item) => ({ id: item.id, name: item.name })),
      blockingSlots: blockingSlots.map((item) => ({ id: item.id, title: item.title })),
    };
  });
}
