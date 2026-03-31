// GraphQL response types for schemes query

export type GqlPointsInfo = {
  conversionPreference?: string | null;
  total?: {
    count?: number | null;
    value?: number | null;
    rewardedWith?: number | null;
  } | null;
  debitableTotal?: {
    count?: number | null;
    value?: number | null;
  } | null;
  nextMileStone?: {
    pointToBeCollected?: number | null;
    rewardedWith?: number | null;
  } | null;
  minRewardsThreshold?: {
    minPointsCollected?: number | null;
    rewardedWith?: number | null;
  } | null;
  minRewardDenomination?: {
    pointsCollected?: number | null;
    rewardedWith?: number | null;
  } | null;
  maxThresholdPerCollectionPeriod?: {
    maxThresholdReached?: boolean | null;
    maxPointsCollectable?: number | null;
    rewardedWith?: number | null;
  } | null;
};

export type GqlPromotionDetails = {
  type?: string | null;
  subType?: string | null;
};

export type GqlCouponOrVoucher = {
  id?: string | null;
  uuid?: string | null;
  alphaNumericId?: string | null;
  description?: string | null;
  expiry?: string | null;
  canBeActivated?: boolean | null;
  validFrom?: string | null;
  maxRedemptionsAllowed?: number | null;
  redemptionsLeft?: number | null;
  promotionId?: string | null;
  value?: number | null;
  classification?: string | null;
  state?: string | null;
  promotionDetails?: GqlPromotionDetails | null;
};

export type GqlScheme = {
  schemeId?: string | null;
  isDebitable?: boolean | null;
  accountStatus?: string | null;
  points?: GqlPointsInfo | null;
  coupons?: Array<GqlCouponOrVoucher | null> | null;
  vouchers?: Array<GqlCouponOrVoucher | null> | null;
};

export type GqlCurrency = {
  iso?: string | null;
  symbol?: string | null;
};

export type GqlError = {
  name?: string | null;
  message?: string | null;
  status?: number | null;
  code?: string | null;
};

export type GqlGetSchemesResponse = {
  loyalty?: {
    schemes?: Array<GqlScheme | null> | null;
    currency?: GqlCurrency | null;
    errors?: Array<GqlError | null> | null;
  } | null;
};
