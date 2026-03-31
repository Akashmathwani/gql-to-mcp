// GraphQL response types for reward vouchers query

export type GqlRedemptionDetails = {
  redeemedOn?: string | null;
  locationId?: string | null;
  locationUuid?: string | null;
  reference?: string | null;
  description?: string | null;
};

export type GqlPromotionDetails = {
  type?: string | null;
  subType?: string | null;
};

export type GqlVoucherDetails = {
  id?: string | null;
  alphaNumericId?: string | null;
  value?: number | null;
  description?: string | null;
  expiry?: string | null;
  validFrom?: string | null;
  maxRedemptionsAllowed?: number | null;
  redemptionsLeft?: number | null;
  promotionId?: string | null;
  redemptionDetails?: Array<GqlRedemptionDetails | null> | null;
  promotionDetails?: GqlPromotionDetails | null;
};

export type GqlScheme = {
  vouchers?: Array<GqlVoucherDetails | null> | null;
};

export type GqlError = {
  name?: string | null;
  message?: string | null;
  status?: number | null;
  code?: string | null;
};

export type GqlGetVouchersResponse = {
  loyalty?: {
    schemes?: Array<GqlScheme | null> | null;
    errors?: Array<GqlError | null> | null;
  } | null;
};
