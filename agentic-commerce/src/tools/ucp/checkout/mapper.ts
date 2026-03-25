// src/tools/ucp/checkout/mapper.ts
// Maps Tesco GQL basket → UCP checkout response shape

import type { UcpMoney, UcpMessage } from '../../../types/ucp.js';
import type { GqlBasket, GqlBasketItem } from './types';

// ── UCP checkout types ────────────────────────────────────────────────────────
// Defined here as checkout types are not in the catalog ucp.ts

export type UcpCheckoutItem = {
  id: string;
  item: {
    id: string;
    title: string;
    image_url?: string;
    price: UcpMoney;
  };
  quantity: number;
  subtotal: UcpMoney;
};

export type UcpCheckout = {
  status: 'open';
  currency: 'GBP';
  line_items: UcpCheckoutItem[];
  totals: {
    subtotal: UcpMoney;
    total: UcpMoney;
    savings?: UcpMoney;
  };
  charges?: {
    surcharge?: UcpMoney;
    bag_charge?: UcpMoney;
    minimum_basket_value?: UcpMoney;
  };
  loyalty?: {
    clubcard_points: number;
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const gbp = (pounds: number | null | undefined): UcpMoney => ({
  amount: Math.round((pounds ?? 0) * 100),
  currency: 'GBP',
});

// ── Mapper ────────────────────────────────────────────────────────────────────

export function toUcpCheckout(basket: GqlBasket): UcpCheckout {
  const items = (basket.items ?? [])
    .filter((i): i is NonNullable<typeof i> => i?.product?.id != null)
    .map(
      (i: GqlBasketItem): UcpCheckoutItem => ({
        id: i.product!.id!,
        item: {
          id: i.product!.id!,
          title: i.product!.title ?? '',
          ...(i.product!.defaultImageUrl && { image_url: i.product!.defaultImageUrl }),
          price: gbp(i.product!.price?.price),
        },
        quantity: i.quantity ?? 1,
        subtotal: gbp(i.cost),
      })
    );

  const charges = basket.charges;

  return {
    status: 'open',
    currency: 'GBP',
    line_items: items,
    totals: {
      subtotal: gbp(basket.guidePrice),
      total: gbp(basket.guidePrice),
      ...(basket.savings && basket.savings > 0 && { savings: gbp(basket.savings) }),
    },
    ...((charges?.surcharge || charges?.bagCharge || charges?.minimumBasketValue) && {
      charges: {
        ...(charges?.surcharge && { surcharge: gbp(charges.surcharge) }),
        ...(charges?.bagCharge && { bag_charge: gbp(charges.bagCharge) }),
        ...(charges?.minimumBasketValue && {
          minimum_basket_value: gbp(charges.minimumBasketValue),
        }),
      },
    }),
    ...(basket.clubcardPoints?.totalPoints && {
      loyalty: { clubcard_points: basket.clubcardPoints.totalPoints },
    }),
  };
}

export function toUcpMessages(basket: GqlBasket): UcpMessage[] {
  return (basket.promotions ?? [])
    .filter((p) => p?.offerText)
    .map((p) => ({
      type: 'info' as const,
      code: 'promotion',
      content: p!.offerText!,
    }));
}
