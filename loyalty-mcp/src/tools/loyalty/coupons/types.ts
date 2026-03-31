// GraphQL response types for coupons query

export type GqlRedemptionDetail = {
  redeemedOn?: string | null;
  locationUuid?: string | null;
  storeId?: string | null;
  reference?: string | null;
  description?: string | null;
};

export type GqlPromotionDetails = {
  type?: string | null;
  subType?: string | null;
};

export type GqlCoupon = {
  id?: string | null;
  uuid?: string | null;
  alphaNumericId?: string | null;
  description?: string | null;
  expiry?: string | null;
  canBeActivated?: boolean | null;
  validFrom?: string | null;
  maxRedemptionsAllowed?: number | null;
  redemptionsLeft?: number | null;
  redemptionDetails?: Array<GqlRedemptionDetail | null> | null;
  promotionId?: string | null;
  value?: number | null;
  classification?: string | null;
  state?: string | null;
  promotionDetails?: GqlPromotionDetails | null;
};

export type GqlCouponsSummary = {
  available?: {
    uniqueCount?: number | null;
    redeemableCount?: number | null;
  } | null;
};

export type GqlError = {
  name?: string | null;
  message?: string | null;
  status?: number | null;
  code?: string | null;
};

export type GqlGetCouponsResponse = {
  loyalty?: {
    coupons?: Array<GqlCoupon | null> | null;
    couponsSummary?: GqlCouponsSummary | null;
    errors?: Array<GqlError | null> | null;
  } | null;
};
