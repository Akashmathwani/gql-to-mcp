import { z } from 'zod';
import type { CustomTool } from 'gql-to-mcp';
import type { GqlGetSchemesResponse, GqlScheme, GqlError, GqlCouponOrVoucher } from './types';
import { GET_SCHEMES_QUERY } from './query.gql';

// ── Input schema ──────────────────────────────────────────────────────────────

const InputSchema = z.object({
  business: z.string().default('grocery').optional().describe('Business context (e.g., grocery)'),
  region: z.string().optional().describe('Region code (e.g., UK, IE, CZ, HU, SK)'),
  language: z.string().optional().describe('Language code'),
  application: z.string().optional().describe('Application identifier'),
  channel: z.enum(['Mobile', 'Web', 'MOBILE', 'WEB', 'INSTORE', 'ONLINE']).default('ONLINE').optional(),
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
    ]).describe('Scheme name to fetch'),
    coupons: z.object({
      period: z.enum(['CURRENT', 'ALL', 'UNTIL_NOW']).describe('Time period for coupons'),
      filters: z.array(z.object({
        classification: z.array(z.enum(['ONLINE', 'INSTORE', 'ONLINE_INSTORE', 'ALL']))
      })).optional()
    }).optional()
  })).optional().describe('Specific schemes to fetch. If omitted, returns all customer schemes'),
  includeCoupons: z.boolean().default(false).optional().describe('Include coupons in scheme details'),
  includeVouchers: z.boolean().default(false).optional().describe('Include vouchers in scheme details')
});

// ── Mapper helpers ────────────────────────────────────────────────────────────

function mapCouponOrVoucher(item: GqlCouponOrVoucher) {
  return {
    id: item.id ?? null,
    uuid: item.uuid ?? null,
    alphaNumericId: item.alphaNumericId ?? null,
    description: item.description ?? null,
    expiry: item.expiry ?? null,
    canBeActivated: item.canBeActivated ?? false,
    validFrom: item.validFrom ?? null,
    maxRedemptionsAllowed: item.maxRedemptionsAllowed ?? 0,
    redemptionsLeft: item.redemptionsLeft ?? 0,
    promotionId: item.promotionId ?? null,
    value: item.value ?? 0,
    classification: item.classification ?? null,
    state: item.state ?? null,
    promotionDetails: item.promotionDetails ? {
      type: item.promotionDetails.type ?? null,
      subType: item.promotionDetails.subType ?? null,
    } : null,
  };
}

function mapScheme(scheme: GqlScheme) {
  const points = scheme.points;
  
  return {
    schemeId: scheme.schemeId ?? null,
    isDebitable: scheme.isDebitable ?? false,
    accountStatus: scheme.accountStatus ?? null,
    points: points ? {
      conversionPreference: points.conversionPreference ?? null,
      total: {
        count: points.total?.count ?? 0,
        value: points.total?.value ?? 0,
        rewardedWith: points.total?.rewardedWith ?? 0,
      },
      debitableTotal: {
        count: points.debitableTotal?.count ?? 0,
        value: points.debitableTotal?.value ?? 0,
      },
      nextMileStone: {
        pointToBeCollected: points.nextMileStone?.pointToBeCollected ?? 0,
        rewardedWith: points.nextMileStone?.rewardedWith ?? 0,
      },
      minRewardsThreshold: points.minRewardsThreshold ? {
        minPointsCollected: points.minRewardsThreshold.minPointsCollected ?? 0,
        rewardedWith: points.minRewardsThreshold.rewardedWith ?? 0,
      } : null,
      minRewardDenomination: points.minRewardDenomination ? {
        pointsCollected: points.minRewardDenomination.pointsCollected ?? 0,
        rewardedWith: points.minRewardDenomination.rewardedWith ?? 0,
      } : null,
      maxThresholdPerCollectionPeriod: points.maxThresholdPerCollectionPeriod ? {
        maxThresholdReached: points.maxThresholdPerCollectionPeriod.maxThresholdReached ?? false,
        maxPointsCollectable: points.maxThresholdPerCollectionPeriod.maxPointsCollectable ?? 0,
        rewardedWith: points.maxThresholdPerCollectionPeriod.rewardedWith ?? 0,
      } : null,
    } : null,
    coupons: (scheme.coupons ?? [])
      .filter((c): c is NonNullable<typeof c> => c != null)
      .map(mapCouponOrVoucher),
    vouchers: (scheme.vouchers ?? [])
      .filter((v): v is NonNullable<typeof v> => v != null)
      .map(mapCouponOrVoucher),
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
 * Get loyalty schemes
 * 
 * Fetches customer's loyalty schemes with points information, account status, and optionally
 * associated coupons and vouchers. Returns all schemes customer is enrolled in unless
 * specific schemes are requested.
 */
export const getSchemes: CustomTool = {
  name: 'get_schemes',
  authMode: 'jwt',
  description: 'Get customer loyalty schemes with points balance, account status, and optional coupons/vouchers. Returns all enrolled schemes or specific requested schemes. Requires authentication.',
  inputSchema: InputSchema,

  async execute(args, ctx) {
    const result = await ctx.gql<GqlGetSchemesResponse>(GET_SCHEMES_QUERY, args);

    if (!result.data?.loyalty) {
      throw new Error('Failed to fetch loyalty schemes');
    }

    const loyalty = result.data.loyalty;
    const schemes = (loyalty.schemes ?? [])
      .filter((s): s is NonNullable<typeof s> => s != null)
      .map(mapScheme);

    // Group schemes by status for easier consumption
    const activeSchemes = schemes.filter(s => s.accountStatus === 'OPEN');
    const inactiveSchemes = schemes.filter(s => s.accountStatus !== 'OPEN');

    return {
      schemes,
      summary: {
        total: schemes.length,
        active: activeSchemes.length,
        inactive: inactiveSchemes.length,
      },
      currency: {
        iso: loyalty.currency?.iso ?? null,
        symbol: loyalty.currency?.symbol ?? null,
      },
      errors: mapErrors(loyalty.errors),
    };
  },
};
