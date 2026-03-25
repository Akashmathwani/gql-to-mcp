// src/tools/ucp/checkout/types.ts

export type GqlBasketProduct = {
  id?: string | null;
  title?: string | null;
  defaultImageUrl?: string | null;
  isForSale?: boolean | null;
  status?: string | null;
  price?: {
    price?: number | null;
    unitPrice?: number | null;
    unitOfMeasure?: string | null;
  } | null;
};

export type GqlBasketItem = {
  quantity?: number | null;
  cost?: number | null;
  unit?: string | null;
  product?: GqlBasketProduct | null;
};

export type GqlBasketPromotion = {
  promotionId?: string | null;
  offerText?: string | null;
};

export type GqlBasket = {
  guidePrice?: number | null;
  savings?: number | null;
  items?: Array<GqlBasketItem | null> | null;
  promotions?: Array<GqlBasketPromotion | null> | null;
  charges?: {
    surcharge?: number | null;
    minimumBasketValue?: number | null;
    bagCharge?: number | null;
  } | null;
  clubcardPoints?: {
    totalPoints?: number | null;
  } | null;
};

export type GqlBasketResponse = {
  basket?: GqlBasket | null;
};
