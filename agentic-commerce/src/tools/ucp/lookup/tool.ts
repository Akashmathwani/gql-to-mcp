import { z } from 'zod';
import type { CustomTool } from 'gql-to-mcp';
import type { UcpProduct, UcpVariant, UcpAvailability, UcpMessage } from '../../../types/ucp.js';
import type { GqlLookupProduct, GqlLookupResponse } from './types';
import { LOOKUP_PRODUCT_QUERY } from './lookup.gql';

// ── UCP metadata envelope ─────────────────────────────────────────────────────

const UCP_META = {
  ucp: {
    version: 'draft',
    capabilities: {
      'dev.ucp.shopping.catalog.lookup': [{ version: 'draft' }],
    },
  },
} as const;

// ── Input schema ──────────────────────────────────────────────────────────────

const InputSchema = z.object({
  meta: z.object({
    'ucp-agent': z.object({
      profile: z.string().describe('UCP agent profile URL'),
    }),
  }),

  catalog: z.object({
    ids: z
      .array(z.string())
      .min(1)
      .max(20)
      .describe(
        'Product or variant IDs to look up — use IDs returned from search_catalog variants[].id'
      ),
    context: z.record(z.unknown()).optional(),
    signals: z.record(z.unknown()).optional(),
  }),
});

// ── Availability ──────────────────────────────────────────────────────────────

function toAvailability(p: GqlLookupProduct): UcpAvailability {
  if (p.isForSale === false) return { available: false };
  if (p.status === 'LOW_STOCK') return { available: true, note: 'limited' };
  return { available: true };
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function toUcpProduct(p: GqlLookupProduct, requestedId: string): UcpProduct {
  const priceInPence = Math.round((p.price?.price ?? 0) * 100);
  const availability = toAvailability(p);
  const media: UcpProduct['media'] = [];

  if (p.defaultImageUrl) media.push({ url: p.defaultImageUrl, type: 'image' });

  // Determine if the requested ID matched the product directly or a specific variation
  const matchedVariationId =
    (p.variations?.products ?? []).find((v) => v?.id === requestedId)?.id ?? null;

  const isProductMatch = !matchedVariationId; // requested ID = product ID

  const baseVariant: UcpVariant = {
    id: p.id ?? '',
    price: { amount: priceInPence, currency: 'GBP' },
    availability,
    // inputs: correlates this variant back to the requested ID
    inputs: [{ id: requestedId, match: isProductMatch ? 'featured' : 'exact' }],
    ...(p.price?.unitPrice != null &&
      p.price?.unitOfMeasure && {
        selected_options: [
          { name: 'unit', label: `${p.price.unitPrice}/${p.price.unitOfMeasure}` },
        ],
      }),
    ...(p.seller?.partnerName && { seller: { name: p.seller.partnerName } }),
  };

  const variationVariants: UcpVariant[] = (p.variations?.products ?? [])
    .filter((v): v is NonNullable<typeof v> => v?.id != null && v.id !== p.id)
    .map((v): UcpVariant => {
      if (v.defaultImageUrl) media.push({ url: v.defaultImageUrl, type: 'image' });

      const selected_options = (v.variationAttributes ?? [])
        .filter(
          (attr): attr is NonNullable<typeof attr> =>
            attr?.attributeGroupData?.name != null && attr?.attributeGroupData?.value != null
        )
        .map((attr) => ({
          name: attr.attributeGroup ?? attr.attributeGroupData!.name!,
          label: attr.attributeGroupData!.value!,
        }));

      return {
        id: v.id as string,
        price: { amount: priceInPence, currency: 'GBP' },
        availability,
        // mark which variation was the exact match for the requested ID
        inputs: [{ id: requestedId, match: v.id === requestedId ? 'exact' : 'featured' }],
        ...(selected_options.length > 0 && { selected_options }),
        ...(p.seller?.partnerName && { seller: { name: p.seller.partnerName } }),
      };
    });

  const fnfRange = p.variations?.priceRange;
  const priceRangeMin =
    fnfRange?.minPrice != null ? Math.round(fnfRange.minPrice * 100) : priceInPence;
  const priceRangeMax =
    fnfRange?.maxPrice != null ? Math.round(fnfRange.maxPrice * 100) : priceInPence;

  return {
    id: p.id ?? '',
    title: p.title ?? '',
    ...(p.description && { description: { plain: p.description } }),
    ...(media.length > 0 && { media }),
    price_range: {
      min: { amount: priceRangeMin, currency: 'GBP' },
      max: { amount: priceRangeMax, currency: 'GBP' },
    },
    variants: [baseVariant, ...variationVariants],
  };
}

// ── Tool ──────────────────────────────────────────────────────────────────────

export const lookupCatalog: CustomTool = {
  name: 'lookup_catalog',
  authMode: 'anonymous',
  description:
    'Look up specific Tesco F&F or Marketplace products by ID. ' +
    "Use IDs returned from search_catalog variants[].id — these map to Tesco's TPNC product identifier. " +
    'Returns current price and availability. Supports up to 20 IDs per request. ' +
    'Variant IDs are usable in create_checkout line_items[].item.id.',
  inputSchema: InputSchema,

  async execute(rawArgs, ctx) {
    const args = InputSchema.parse(rawArgs);
    const { ids } = args.catalog;

    // Fetch all products in parallel
    const settled = await Promise.allSettled(
      ids.map((id) => ctx.gql<GqlLookupResponse>(LOOKUP_PRODUCT_QUERY, { tpnc: id }))
    );

    const products: UcpProduct[] = [];
    const messages: UcpMessage[] = [];

    settled.forEach((result, i) => {
      const requestedId = ids[i];

      if (result.status === 'rejected') {
        messages.push({
          type: 'warning',
          code: 'lookup_failed',
          content: requestedId,
        });
        return;
      }

      const product = result.value.data?.product;

      if (!product?.id) {
        messages.push({
          type: 'info',
          code: 'not_found',
          content: requestedId,
        });
        return;
      }

      // Promotion messages
      (product.promotions ?? [])
        .filter((promo) => promo?.offerText)
        .forEach((promo) => {
          messages.push({
            type: 'info',
            code: 'promotion',
            content: promo!.offerText!,
          });
        });

      products.push(toUcpProduct(product, requestedId));
    });

    return {
      ...UCP_META,
      products,
      ...(messages.length > 0 && { messages }),
    };
  },
};
