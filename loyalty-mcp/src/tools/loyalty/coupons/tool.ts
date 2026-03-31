import { z } from 'zod';
import type { CustomTool } from 'gql-to-mcp';
import type { GqlGetCouponsResponse, GqlCoupon, GqlError } from './types';
import { GET_COUPONS_QUERY } from './query.gql';

// ── Input schema ──────────────────────────────────────────────────────────────

const InputSchema = z.object({
  business: z.string().default('grocery').optional(),
  region: z.string().optional(),
  language: z.string().optional(),
  application: z.string().optional(),
  channel: z.enum(['Mobile', 'Web', 'MOBILE', 'WEB', 'INSTORE', 'ONLINE']).default('ONLINE').optional(),
  couponIdList: z.array(z.string()).optional().describe('List of specific coupon IDs to retrieve'),
  filters: z.object({
    period: z.enum(['CURRENT', 'ALL', 'UNTIL_NOW']).optional().describe('Time period filter'),
    fields: z.object({
      couponTypes: z.array(z.string()).optional().describe('Filter by coupon types'),
      couponState: z.array(z.string()).optional().describe('Filter by coupon states (ISSUED, ACTIVATED, REDEEMED, etc.)')
    }).optional(),
    dateRange: z.object({
      fieldName: z.string().describe('Date field to filter on'),
      from: z.string().describe('Start date (ISO format)'),
      to: z.string().describe('End date (ISO format)')
    }).optional()
  }).optional().describe('Advanced filters for coupons')
});

// ── Mapper helpers ────────────────────────────────────────────────────────────

function mapCoupon(coupon: GqlCoupon) {
  return {
    id: coupon.id ?? null,
    uuid: coupon.uuid ?? null,
    alphaNumericId: coupon.alphaNumericId ?? null,
    description: coupon.description ?? null,
    expiry: coupon.expiry ?? null,
    canBeActivated: coupon.canBeActivated ?? false,
    validFrom: coupon.validFrom ?? null,
    maxRedemptionsAllowed: coupon.maxRedemptionsAllowed ?? 0,
    redemptionsLeft: coupon.redemptionsLeft ?? 0,
    redemptionDetails: (coupon.redemptionDetails ?? [])
      .filter((d): d is NonNullable<typeof d> => d != null)
      .map(d => ({
        redeemedOn: d.redeemedOn ?? null,
        locationUuid: d.locationUuid ?? null,
        storeId: d.storeId ?? null,
        reference: d.reference ?? null,
        description: d.description ?? null,
      })),
    promotionId: coupon.promotionId ?? null,
    value: coupon.value ?? 0,
    classification: coupon.classification ?? null,
    state: coupon.state ?? null,
    promotionDetails: coupon.promotionDetails ? {
      type: coupon.promotionDetails.type ?? null,
      subType: coupon.promotionDetails.subType ?? null,
    } : null,
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
 * Get loyalty coupons
 * 
 * Fetches customer's coupons with optional filtering by IDs, period, types, and states.
 * Includes summary counts for available coupons.
 */
export const getCoupons: CustomTool = {
  name: 'get_coupons',
  authMode: 'jwt',
  description: 'Get customer loyalty coupons with filters. Returns coupon details including redemption history and summary counts. Requires authentication.',
  inputSchema: InputSchema,

  async execute(args, ctx) {
    const result = await ctx.gql<GqlGetCouponsResponse>(GET_COUPONS_QUERY, args);

    if (!result.data?.loyalty) {
      throw new Error('Failed to fetch coupons');
    }

    const loyalty = result.data.loyalty;
    const coupons = (loyalty.coupons ?? [])
      .filter((c): c is NonNullable<typeof c> => c != null)
      .map(mapCoupon);

    return {
      coupons,
      summary: {
        uniqueCount: loyalty.couponsSummary?.available?.uniqueCount ?? 0,
        redeemableCount: loyalty.couponsSummary?.available?.redeemableCount ?? 0,
      },
      errors: mapErrors(loyalty.errors),
    };
  },
};
