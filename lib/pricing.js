export function parseFixedPrice(priceLabel) {
  const label = String(priceLabel || '').trim().toLowerCase();
  if (!label || label.includes('devis')) return null;

  const normalized = label.replace(',', '.');
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  return Number(match[1]);
}

export function summarizeCart(items, fees = {}) {
  let subtotalFixed = 0;
  let hasQuoteItems = false;

  const lines = items.map((item) => {
    const unitPrice = parseFixedPrice(item.product?.price);
    const quantity = Number(item.quantity || 1);
    const lineTotal = unitPrice == null ? null : unitPrice * quantity;

    if (lineTotal == null) hasQuoteItems = true;
    else subtotalFixed += lineTotal;

    return {
      itemId: item.id,
      productId: item.productId,
      name: item.product?.name || 'Offre',
      priceLabel: item.product?.price || 'Sur devis',
      unitPrice,
      quantity,
      note: item.note || '',
      variant: item.variant || '',
      lineTotal,
    };
  });

  const deliveryFee = Number(fees.deliveryFee || 0);
  const installationFee = Number(fees.installationFee || 0);

  return {
    lines,
    subtotalFixed,
    deliveryFee,
    installationFee,
    totalFixed: subtotalFixed + deliveryFee + installationFee,
    hasQuoteItems,
  };
}
