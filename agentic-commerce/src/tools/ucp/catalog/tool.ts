import { z } from 'zod';
import type { CustomTool } from 'gql-to-mcp';
import type { UcpProduct, UcpVariant, UcpAvailability, UcpMessage } from '@/types/ucp';
import type { GqlProductItem, GqlSearchResponse, GqlBrowseResponse, GqlPageInfo } from './types';
import { SEARCH_PRODUCTS_QUERY } from './search.query.gql';
import { BROWSE_CATEGORY_QUERY } from './browse.query.gql';

// ── UCP metadata envelope ─────────────────────────────────────────────────────

const UCP_META = {
  ucp: {
    version: 'draft',
    capabilities: {
      'dev.ucp.shopping.catalog.search': [{ version: 'draft' }],
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

  catalog: z
    .object({
      query: z
        .string()
        .optional()
        .describe(
          'Free-text search query. Omit for category browse — must provide ' +
            'filters.superDepartment or filters.department instead.'
        ),

      context: z.record(z.unknown()).optional(),
      signals: z.record(z.unknown()).optional(),

      filters: z
        .object({
          brand: z.string().optional().describe('Filter by brand name'),
          superDepartment: z
            .string()
            .optional()
            .describe('Top-level department e.g. "Clothing & Accessories"'),
          department: z
            .string()
            .optional()
            .describe('Department within a superDepartment e.g. "Women\'s Clothing"'),
          offers: z.boolean().optional().describe('Only return products with active promotions'),
        })
        .optional(),

      pagination: z
        .object({
          limit: z.number().int().min(1).max(100).default(10),
          cursor: z.string().optional(),
        })
        .optional(),
    })
    .refine((c) => c.query !== undefined || c.filters !== undefined, {
      message: 'At least one of catalog.query or catalog.filters is required',
    }),
});

// ── Cursor helpers ────────────────────────────────────────────────────────────

type Cursor = { page: number; offset: number };

function decodeCursor(cursor?: string): Cursor {
  if (!cursor) return { page: 1, offset: 0 };
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'page' in parsed &&
      'offset' in parsed &&
      typeof (parsed as Cursor).page === 'number' &&
      typeof (parsed as Cursor).offset === 'number'
    )
      return parsed as Cursor;
    return { page: 1, offset: 0 };
  } catch {
    return { page: 1, offset: 0 };
  }
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64');
}

// ── Availability ──────────────────────────────────────────────────────────────

function toAvailability(p: GqlProductItem): UcpAvailability {
  if (p.isForSale === false) return { available: false };
  if (p.status === 'LOW_STOCK') return { available: true, note: 'limited' };
  return { available: true };
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function toUcpProduct(p: GqlProductItem): UcpProduct {
  const priceInPence = Math.round((p.price?.price ?? 0) * 100);
  const media: UcpProduct['media'] = [];

  if (p.defaultImageUrl) media.push({ url: p.defaultImageUrl, type: 'image' });

  const baseVariant: UcpVariant = {
    id: p.id ?? '',
    price: { amount: priceInPence, currency: 'GBP' },
    availability: toAvailability(p),
    ...(p.price?.unitPrice != null &&
      p.price?.unitOfMeasure && {
        selected_options: [
          { name: 'unit', label: `${p.price.unitPrice}/${p.price.unitOfMeasure}` },
        ],
      }),
    ...(p.seller?.name && { seller: { name: p.seller.name } }),
  };

  const variationVariants: UcpVariant[] = (p.variations?.products ?? [])
    .filter((v): v is NonNullable<typeof v> => v?.id != null && v.id !== p.id)
    .map((v): UcpVariant => {
      if (v.defaultImageUrl) media.push({ url: v.defaultImageUrl, type: 'image' });

      // attributeGroupData is a single object (not array) — use attributeGroup as name
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
        id: v?.id as string,
        price: { amount: priceInPence, currency: 'GBP' },
        availability: toAvailability(p),
        ...(selected_options.length > 0 && { selected_options }),
        ...(p.seller?.name && { seller: { name: p.seller.name } }),
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
    ...(p.shortDescription && { description: { plain: p.shortDescription } }),
    ...(media.length > 0 && { media }),
    price_range: {
      min: { amount: priceRangeMin, currency: 'GBP' },
      max: { amount: priceRangeMax, currency: 'GBP' },
    },
    variants: [baseVariant, ...variationVariants],
    ...(p.reviews?.stats?.overallRating != null && {
      rating: {
        value: p.reviews.stats.overallRating,
        scale_max: p.reviews.stats.overallRatingRange ?? 5,
        count: p.reviews.stats.noOfReviews ?? 0,
      },
    }),
  };
}

function toUcpMessages(p: GqlProductItem): UcpMessage[] {
  return (p.promotions ?? [])
    .filter((promo) => promo?.offerText)
    .map((promo) => ({ type: 'info' as const, code: 'promotion', content: promo!.offerText! }));
}

// ── Shared response builder ───────────────────────────────────────────────────

function buildResponse(
  items: GqlProductItem[],
  info: GqlPageInfo | null | undefined,
  limit: number,
  page: number,
  offset: number
) {
  const messages = items.flatMap(toUcpMessages);
  const count = info?.count ?? limit;
  const currentOffset = info?.offset ?? offset;
  const total = info?.totalCount ?? 0;
  const hasMore = currentOffset + count < total;

  return {
    ...UCP_META,
    products: items.map(toUcpProduct),
    pagination: {
      total_count: total,
      has_next_page: hasMore,
      ...(hasMore && {
        cursor: encodeCursor({ page: (info?.pageNo ?? page) + 1, offset: currentOffset + count }),
      }),
    },
    ...(messages.length > 0 && { messages }),
  };
}

// ── Tool ──────────────────────────────────────────────────────────────────────

export const searchCatalog: CustomTool = {
  name: 'search_catalog',
  authMode: 'anonymous',
  description:
    "Search or browse Tesco's Fashion & Lifestyle (F&F) and Marketplace catalog. " +
    'Covers clothing, homeware, and third-party marketplace items — grocery/food not available. ' +
    'Use catalog.query for text search. Omit query and use filters.superDepartment or ' +
    'filters.department for category browsing. ' +
    'Variant IDs returned are usable in create_checkout line_items[].item.id.',
  inputSchema: InputSchema,

  async execute(rawArgs, ctx) {
    const args = InputSchema.parse(rawArgs);
    const { catalog } = args;
    const { page, offset } = decodeCursor(catalog.pagination?.cursor);
    const limit = catalog.pagination?.limit ?? 10;
    const filters = catalog.filters;

    const gqlFilters = {
      page,
      count: limit,
      offset,
      brand: filters?.brand ?? null,
      superDepartment: filters?.superDepartment ?? null,
      department: filters?.department ?? null,
      offers: filters?.offers ?? null,
    };

    if (catalog.query) {
      const result = await ctx.gql<GqlSearchResponse>(SEARCH_PRODUCTS_QUERY, {
        query: catalog.query,
        ...gqlFilters,
      });
      const items = (result.data.search?.productItems ?? []).filter(
        (p): p is GqlProductItem => p != null
      );
      return buildResponse(items, result.data.search?.pageInformation, limit, page, offset);
    } else {
      if (!filters?.superDepartment && !filters?.department) {
        return {
          ...UCP_META,
          products: [],
          pagination: { has_next_page: false, total_count: 0 },
          messages: [
            {
              type: 'warning' as const,
              code: 'missing_browse_context',
              content: 'Browse requires at least filters.superDepartment or filters.department.',
            },
          ],
        };
      }
      console.log(gqlFilters);
      const result = await ctx.gql<GqlBrowseResponse>(BROWSE_CATEGORY_QUERY, gqlFilters);
      const items = (result.data.category?.productItems ?? []).filter(
        (p): p is GqlProductItem => p != null
      );
      return buildResponse(items, result.data.category?.pageInformation, limit, page, offset);
    }
  },
};
