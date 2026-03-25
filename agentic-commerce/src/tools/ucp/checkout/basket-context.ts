// src/tools/ucp/checkout/basket-context.ts
// Derives basketContexts for UpdateItems mutation from product __typename.
// Reuses the existing LOOKUP_PRODUCT_QUERY — no separate query needed.

import { LOOKUP_PRODUCT_QUERY } from '../lookup/lookup.gql';
import type { GqlLookupResponse } from '../lookup/types.js';

type BasketContextType = 'FNF' | 'MARKETPLACE';

type ToolContext = {
  gql<T>(operation: string, variables?: Record<string, unknown>): Promise<{ data: T }>;
};

/**
 * Given a list of TPNCs, fetches each product in parallel and derives
 * the basketContext type from __typename.
 *
 * Rules:
 *   __typename === 'FNFProduct'  → 'FNF'
 *   __typename === 'MPProduct'   → 'MARKETPLACE'
 *   anything else                → throws — unsupported product type
 *
 * All items must be the same context type (can't mix FNF and Marketplace
 * in one basket call). Throws if mixed types are detected.
 */
export async function deriveBasketContext(
  tpncs: string[],
  ctx: ToolContext
): Promise<BasketContextType> {
  const results = await Promise.allSettled(
    tpncs.map((tpnc) => ctx.gql<GqlLookupResponse>(LOOKUP_PRODUCT_QUERY, { tpnc }))
  );
  console.log(JSON.stringify(results), 'deriveBasketContext', tpncs);

  const types = new Set<BasketContextType>();

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(
        `Failed to resolve product type for item ${tpncs[i]}: ${String(result.reason)}`
      );
      throw new Error(
        `Failed to resolve product type for item ${tpncs[i]}: ${String(result.reason)}`
      );
    }

    const typename = result?.value?.data?.product?.__typename;
    console.log({ typename });

    if (typename === 'FNFProduct') {
      types.add('FNF');
    } else if (typename === 'MPProduct') {
      types.add('MARKETPLACE');
    } else {
      throw new Error(
        `Unsupported product type '${typename ?? 'unknown'}' for item ${tpncs[i]}. ` +
          'Only FNF and Marketplace products are supported.'
      );
    }
  });

  if (types.size > 1) {
    throw new Error(
      'Mixed product types in one checkout are not supported. ' +
        'All items must be either FNF or Marketplace, not both.'
    );
  }

  return types.values().next().value as BasketContextType;
}
