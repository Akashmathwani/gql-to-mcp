import { z } from 'zod';
import type { CustomTool } from 'gql-to-mcp';
import type { GqlGetVouchersResponse, GqlVoucherDetails, GqlError } from './types';
import { GET_VOUCHERS_QUERY } from './query.gql';

// ── Input schema ──────────────────────────────────────────────────────────────

const InputSchema = z.object({
  schemes: z.array(z.object({
    schemeName: z.enum([
      'UK_CLUBCARD',
      'UK_CLUBCARD_PLUS',
      'UK_COLLEAGUE_DISCOUNT',
      'IE_CLUBCARD',
      'IE_COLLEAGUE_DISCOUNT',
      'UK_CLUBCARD_SAVERS',
      'IE_CLUBCARD_SAVERS',
      'CZ_CLUBCARD',
      'CZ_COLLEAGUE_DISCOUNT',
      'HU_CLUBCARD',
      'HU_COLLEAGUE_DISCOUNT',
      'SK_CLUBCARD',
      'SK_COLLEAGUE_DISCOUNT'
    ]).describe('Loyalty scheme name'),
    coupons: z.object({
      period: z.enum(['CURRENT', 'ALL', 'UNTIL_NOW']).describe('Time period for coupons'),
      filters: z.object({
        classification: z.array(z.enum(['ONLINE', 'INSTORE', 'ONLINE_INSTORE', 'ALL'])).describe('Coupon classification filter')
      }).optional()
    }).optional()
  })).optional().describe('Specific loyalty schemes to fetch vouchers from'),
  loyaltyContexts: z.array(z.object({
    type: z.enum(['ONLINE_REWARDS', 'INSTORE_REWARDS']).describe('Type of loyalty context')
  })).optional().describe('Loyalty context types to query')
});

// ── Mapper helpers ────────────────────────────────────────────────────────────

function mapVoucher(voucher: GqlVoucherDetails) {
  return {
    id: voucher.id ?? null,
    alphaNumericId: voucher.alphaNumericId ?? null,
    description: voucher.description ?? null,
    validFrom: voucher.validFrom ?? null,
    expiry: voucher.expiry ?? null,
    redemptionsLeft: voucher.redemptionsLeft ?? 0,
    maxRedemptionsAllowed: voucher.maxRedemptionsAllowed ?? 0,
    value: voucher.value ?? 0,
    promotionId: voucher.promotionId ?? null,
    promotionDetails: {
      type: voucher.promotionDetails?.type ?? null,
      subType: voucher.promotionDetails?.subType ?? null,
    },
    redemptionDetails: (voucher.redemptionDetails ?? [])
      .filter((d): d is NonNullable<typeof d> => d != null)
      .map(d => ({
        redeemedOn: d.redeemedOn ?? null,
        locationId: d.locationId ?? null,
        locationUuid: d.locationUuid ?? null,
        reference: d.reference ?? null,
        description: d.description ?? null,
      })),
  };
}

function mapErrors(errors: Array<GqlError | null> | null | undefined) {
  return (errors ?? [])
    .filter((e): e is NonNullable<typeof e> => e != null)
    .map(e => ({
      name: e.name ?? null,
      message: e.message ?? null,
      status: e.status ?? null,
      code: e.code ?? null,
    }));
}

// ── Tool ──────────────────────────────────────────────────────────────────────

/**
 * Get loyalty vouchers
 * 
 * Fetches customer's vouchers with summary (available, issued, spent) and detailed list.
 * Supports filtering by voucher types, states, and time periods.
 */
export const getVouchers: CustomTool = {
  name: 'get_vouchers',
  authMode: 'jwt',
  description: 'Get customer loyalty vouchers with summary and detailed list. Supports filtering by type, state, and period. Requires authentication.',
  inputSchema: InputSchema,

  async execute(args, ctx) {
    const result = await ctx.gql<GqlGetVouchersResponse>(GET_VOUCHERS_QUERY, args);

    if (!result.data?.loyalty) {
      throw new Error('Failed to fetch vouchers');
    }

    const loyalty = result.data.loyalty;
    
    // Flatten all vouchers from all schemes
    const vouchers = (loyalty.schemes ?? [])
      .filter((scheme): scheme is NonNullable<typeof scheme> => scheme != null)
      .flatMap(scheme => (scheme.vouchers ?? []))
      .filter((v): v is NonNullable<typeof v> => v != null)
      .map(mapVoucher);

    return {
      vouchers,
      errors: mapErrors(loyalty.errors),
    };
  },
};
