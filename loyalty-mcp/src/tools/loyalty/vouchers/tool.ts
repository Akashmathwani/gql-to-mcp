import { z } from 'zod';
import type { CustomTool } from 'gql-to-mcp';
import type { GqlGetVouchersResponse, GqlVoucherDetails, GqlError } from './types';
import { GET_VOUCHERS_QUERY } from './query.gql';

// ── Input schema ──────────────────────────────────────────────────────────────

const InputSchema = z.object({
  business: z.string().default('grocery').optional(),
  region: z.string().optional(),
  language: z.string().optional(),
  application: z.string().optional(),
  channel: z.enum(['Mobile', 'Web', 'MOBILE', 'WEB', 'INSTORE', 'ONLINE']).default('ONLINE').optional(),
  filters: z.object({
    subType: z.array(z.enum([
      'CLUBCARD',
      'CHRISTMAS_BONUS',
      'CHRISTMAS_SAVER_TOP_UP',
      'FASTER_DIGITAL_VOUCHER'
    ])).optional().describe('Filter by voucher sub-types')
  }).optional(),
  detailsFilters: z.object({
    period: z.enum(['ALL', 'CURRENT', 'UNTILNOW']).describe('Time period for vouchers'),
    state: z.array(z.enum(['AVAILABLE', 'REDEEMED', 'CANCELLED', 'ACTIVATED', 'EXPIRED'])).describe('Voucher states to include'),
    voucherType: z.array(z.enum([
      'CLUBCARD',
      'CHRISTMAS_BONUS',
      'CHRISTMAS_SAVER_TOP_UP',
      'FASTER_DIGITAL_VOUCHER'
    ])).optional().describe('Voucher types to include')
  }).optional().describe('Filters for voucher details list')
});

// ── Mapper helpers ────────────────────────────────────────────────────────────

function mapVoucher(voucher: GqlVoucherDetails) {
  return {
    id: voucher.id ?? null,
    description: voucher.description ?? null,
    validFrom: voucher.validFrom ?? null,
    expiryDate: voucher.expiryDate ?? null,
    state: voucher.state ?? null,
    scannableCode: voucher.scannableCode ?? null,
    redemptionsLeft: voucher.redemptionsLeft ?? 0,
    maxRedemptionsLimit: voucher.maxRedemptionsLimit ?? 0,
    type: voucher.type ?? null,
    value: voucher.value ?? null,
    keyInCode: voucher.keyInCode ?? null,
    redemptionDetails: (voucher.redemptionDetails ?? [])
      .filter((d): d is NonNullable<typeof d> => d != null)
      .map(d => ({
        id: d.id ?? null,
        redeemedOn: d.redeemedOn ?? null,
        type: d.type ?? null,
        location: d.location ?? null,
        locationId: d.locationId ?? null,
        locationUuid: d.locationUuid ?? null,
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
    const vouchers = (loyalty.vouchers?.list ?? [])
      .filter((v): v is NonNullable<typeof v> => v != null)
      .map(mapVoucher);

    return {
      vouchers,
      summary: {
        available: loyalty.vouchers?.summary?.available ?? 0,
        issued: loyalty.vouchers?.summary?.issued ?? 0,
        spent: loyalty.vouchers?.summary?.spent ?? 0,
      },
      totalValue: loyalty.vouchersTotalValue ?? 0,
      currency: {
        iso: loyalty.currency?.iso ?? null,
        symbol: loyalty.currency?.symbol ?? null,
      },
      errors: mapErrors(loyalty.errors),
    };
  },
};
