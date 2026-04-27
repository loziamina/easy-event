import { parseFixedPrice } from './pricing';

export const QUOTE_STATUS = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  REFUSED: 'REFUSED',
};

export function quoteNumber(eventId) {
  const date = new Date();
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join('');
  return `DEV-${eventId}-${stamp}`;
}

export function buildQuoteLinesFromEvent(event, calculationMode = 'MIXED') {
  const guestCount = Number(event.guestCount || 1);

  return (event.items || []).map((item) => {
    const product = item.product || {};
    const fixedPrice = parseFixedPrice(product.price);
    const quantity = Number(item.quantity || 1);
    const strategy = fixedPrice == null
      ? 'QUOTE'
      : calculationMode === 'PER_GUEST'
        ? 'PER_GUEST'
        : product.type === 'PACK'
          ? 'PACKAGE'
          : 'FIXED';

    const computedQuantity = strategy === 'PER_GUEST' ? guestCount : quantity;
    const lineTotal = fixedPrice == null ? null : fixedPrice * computedQuantity;

    return {
      label: product.name || 'Prestation',
      description: [item.variant, item.note].filter(Boolean).join(' - ') || product.description || null,
      strategy,
      unitPrice: fixedPrice,
      quantity: computedQuantity,
      guestCount: strategy === 'PER_GUEST' ? guestCount : null,
      lineTotal,
    };
  });
}

export function summarizeQuoteLines(lines, fees = {}) {
  const subtotal = lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  const deliveryFee = Number(fees.deliveryFee || 0);
  const installationFee = Number(fees.installationFee || 0);
  const discount = Number(fees.discount || 0);
  const total = Math.max(0, subtotal + deliveryFee + installationFee - discount);

  return { subtotal, deliveryFee, installationFee, discount, total };
}
