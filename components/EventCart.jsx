import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from './ToastProvider';

const emptyCheckout = {
  deliveryAddress: '',
  deliverySlot: '',
  clientNotes: '',
  deliveryFee: '0',
  installationFee: '0',
};

function money(value) {
  return Number(value || 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  });
}

function minutesLeft(date) {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 60000);
}

export default function EventCart({ eventId }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [checkout, setCheckout] = useState(emptyCheckout);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const localSummary = useMemo(() => {
    const subtotalFixed = summary?.subtotalFixed || 0;
    const deliveryFee = Number(checkout.deliveryFee || 0);
    const installationFee = Number(checkout.installationFee || 0);
    return {
      subtotalFixed,
      deliveryFee,
      installationFee,
      totalFixed: subtotalFixed + deliveryFee + installationFee,
      hasQuoteItems: Boolean(summary?.hasQuoteItems),
    };
  }, [summary, checkout.deliveryFee, checkout.installationFee]);

  async function fetchItems() {
    if (!eventId) return;
    setLoading(true);

    const res = await fetch(`/api/events/${eventId}/items`);
    const data = await res.json().catch(() => ({ items: [] }));

    if (res.ok) {
      setItems(data.items || []);
      setSummary(data.summary || null);
    } else {
      console.error('Failed to fetch cart items', data);
    }

    setLoading(false);
  }

  async function fetchOrders() {
    if (!eventId) return;
    const res = await fetch(`/api/events/${eventId}/order`);
    const data = await res.json().catch(() => ({ orders: [] }));
    if (res.ok) setOrders(data.orders || []);
  }

  useEffect(() => {
    setItems([]);
    setSummary(null);
    setOrders([]);
    setCheckout(emptyCheckout);
    fetchItems();
    fetchOrders();
  }, [eventId]);

  function updateCheckout(field, value) {
    setCheckout((current) => ({ ...current, [field]: value }));
  }

  async function updateQuantity(itemId, quantity, note, variant) {
    if (quantity < 1) return;

    const res = await fetch(`/api/events/${eventId}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, quantity, note, variant }),
    });

    if (!res.ok) {
      error('Quantite non mise a jour', await res.text());
      return;
    }

    fetchItems();
  }

  async function updateLine(item, patch) {
    await updateQuantity(
      item.id,
      patch.quantity ?? item.quantity,
      patch.note ?? item.note ?? '',
      patch.variant ?? item.variant ?? ''
    );
  }

  async function removeItem(itemId) {
    const res = await fetch(`/api/events/${eventId}/items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    });

    if (!res.ok && res.status !== 204) {
      error('Suppression impossible', "L'article n'a pas pu etre retire.");
      return;
    }

    fetchItems();
  }

  async function submitOrder(e) {
    e.preventDefault();

    const res = await fetch(`/api/events/${eventId}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkout),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      error('Commande impossible', data.message || 'Erreur commande');
      return;
    }

    success('Commande creee', `Commande #${data.order.id}. Reservation active environ 30 minutes.`);
    setCheckout(emptyCheckout);
    fetchItems();
    fetchOrders();
  }

  return (
    <div className="bg-white border rounded-2xl p-5 shadow-sm">
      <h3 className="text-xl font-bold mb-4">Panier de l'evenement</h3>

      {!eventId && <p className="text-gray-500">Choisis d'abord un evenement.</p>}
      {eventId && loading && <p className="text-gray-500">Chargement du panier...</p>}
      {eventId && !loading && items.length === 0 && <p className="text-gray-500">Aucun produit dans le panier.</p>}

      <div className="space-y-4">
        {items.map((item) => {
          const reservationMinutes = minutesLeft(item.reservedUntil);

          return (
            <div key={item.id} className="border rounded-xl p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={item.product?.image || 'https://placehold.co/120x90?text=Produit'}
                    alt={item.product?.name || 'Produit'}
                    className="w-24 h-20 object-cover rounded-lg border"
                  />
                  <div>
                    <h4 className="font-bold">{item.product?.name}</h4>
                    <p className="text-gray-500 text-sm">{item.product?.price}</p>
                    <p className="text-xs text-gray-500">
                      {reservationMinutes == null
                        ? 'Pas encore reserve'
                        : reservationMinutes > 0
                          ? `Reserve temporairement: ${reservationMinutes} min`
                          : 'Reservation expiree'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.note, item.variant)} className="px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200">
                    -
                  </button>
                  <span className="font-semibold min-w-[24px] text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.note, item.variant)} className="px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200">
                    +
                  </button>
                  <button onClick={() => removeItem(item.id)} className="px-3 py-1 rounded-full bg-red-100 text-red-800 hover:bg-red-200">
                    Supprimer
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <input
                  className="p-3 border rounded-xl"
                  placeholder="Option/variante: dore, XL, 50 pieces..."
                  value={item.variant || ''}
                  onChange={(e) => updateLine(item, { variant: e.target.value })}
                />
                <input
                  className="p-3 border rounded-xl"
                  placeholder="Note client: je veux du dore..."
                  value={item.note || ''}
                  onChange={(e) => updateLine(item, { note: e.target.value })}
                />
              </div>
            </div>
          );
        })}
      </div>

      {eventId && items.length > 0 && (
        <div className="mt-6 grid lg:grid-cols-[1fr_360px] gap-6">
          <form onSubmit={submitOrder} className="border rounded-xl p-4 space-y-4">
            <h4 className="font-bold text-lg">Livraison / installation</h4>
            <input
              className="w-full p-3 border rounded-xl"
              placeholder="Adresse de livraison / installation"
              value={checkout.deliveryAddress}
              onChange={(e) => updateCheckout('deliveryAddress', e.target.value)}
              required
            />
            <input
              className="w-full p-3 border rounded-xl"
              placeholder="Creneau souhaite: 14/05 09h-11h"
              value={checkout.deliverySlot}
              onChange={(e) => updateCheckout('deliverySlot', e.target.value)}
              required
            />
            <textarea
              className="w-full p-3 border rounded-xl"
              rows="3"
              placeholder="Notes globales pour la commande"
              value={checkout.clientNotes}
              onChange={(e) => updateCheckout('clientNotes', e.target.value)}
            />
            <div className="grid md:grid-cols-2 gap-3">
              <input
                className="p-3 border rounded-xl"
                type="number"
                min="0"
                step="0.01"
                placeholder="Frais livraison"
                value={checkout.deliveryFee}
                onChange={(e) => updateCheckout('deliveryFee', e.target.value)}
              />
              <input
                className="p-3 border rounded-xl"
                type="number"
                min="0"
                step="0.01"
                placeholder="Frais installation"
                value={checkout.installationFee}
                onChange={(e) => updateCheckout('installationFee', e.target.value)}
              />
            </div>

            <button className="bg-violet-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-violet-700">
              Convertir le panier en commande
            </button>
          </form>

          <div className="border rounded-xl p-4 h-fit">
            <h4 className="font-bold text-lg mb-3">Total</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Sous-total prix fixes</span>
                <span>{money(localSummary.subtotalFixed)}</span>
              </div>
              <div className="flex justify-between">
                <span>Livraison</span>
                <span>{money(localSummary.deliveryFee)}</span>
              </div>
              <div className="flex justify-between">
                <span>Installation</span>
                <span>{money(localSummary.installationFee)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-base">
                <span>Total fixe</span>
                <span>{money(localSummary.totalFixed)}</span>
              </div>
              {localSummary.hasQuoteItems && (
                <p className="text-amber-700 bg-amber-50 rounded-lg p-2">
                  Certains elements sont sur devis et seront confirmes par l'equipe.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-6 border rounded-xl p-4">
          <h4 className="font-bold text-lg mb-3">Commandes creees</h4>
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex flex-col md:flex-row md:justify-between gap-2">
                  <p className="font-semibold">Commande #{order.id} - {order.status}</p>
                  <p>{money(order.totalFixed)}{order.hasQuoteItems ? ' + sur devis' : ''}</p>
                </div>
                <p className="text-gray-600">{order.deliveryAddress} - {order.deliverySlot}</p>
                <p className="text-gray-500">
                  Reservation: {minutesLeft(order.reservedUntil) ?? 0} min restantes
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
