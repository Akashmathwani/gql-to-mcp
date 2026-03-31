// GraphQL response types for vouchers query

export type GqlRedemptionDetails = {
  id?: string | null;
  redeemedOn?: string | null;
  type?: string | null;
  location?: string | null;
  locationId?: string | null;
  locationUuid?: string | null;
};

export type GqlVoucherDetails = {
  id?: string | null;
  description?: string | null;
  validFrom?: string | null;
  expiryDate?: string | null;
  state?: string | null;
  scannableCode?: string | null;
  redemptionsLeft?: number | null;
  maxRedemptionsLimit?: number | null;
  type?: string | null;
  value?: string | null;
  keyInCode?: string | null;
  redemptionDetails?: Array<GqlRedemptionDetails | null> | null;
};

export type GqlVoucherSummary = {
  available?: number | null;
  issued?: number | null;
  spent?: number | null;
};

export type GqlVouchers = {
  summary?: GqlVoucherSummary | null;
  list?: Array<GqlVoucherDetails | null> | null;
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

export type GqlGetVouchersResponse = {
  loyalty?: {
    vouchers?: GqlVouchers | null;
    vouchersTotalValue?: number | null;
    currency?: GqlCurrency | null;
    errors?: Array<GqlError | null> | null;
  } | null;
};
