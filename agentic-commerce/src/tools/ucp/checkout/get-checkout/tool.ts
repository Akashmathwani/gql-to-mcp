import { z } from 'zod';
import type { CustomTool } from 'gql-to-mcp';
import { toUcpCheckout, toUcpMessages } from '../mapper';
import { GET_BASKET_QUERY } from '../queries';
import type { GqlBasketResponse } from '../types';

const UCP_META = {
  ucp: {
    version: 'draft',
    capabilities: {
      'dev.ucp.shopping.checkout': [{ version: 'draft' }],
    },
  },
} as const;

const InputSchema = z.object({
  meta: z.object({
    'ucp-agent': z.object({ profile: z.string() }),
  }),

  checkout: z
    .object({
      catalog_type: z
        .enum(['FNF', 'MARKETPLACE'])
        .default('FNF')
        .describe(
          'Which basket to retrieve. Pass "FNF" for Fashion & Lifestyle basket, ' +
            '"MARKETPLACE" for Marketplace basket. Defaults to "FNF".'
        ),
    })
    .optional(),
});

export const getCheckout: CustomTool = {
  name: 'get_checkout',
  authMode: 'jwt',
  description:
    'Retrieve the current Tesco basket state. ' +
    'Returns all line items, quantities, and current totals. ' +
    'Creates an empty basket if none exists. ' +
    'Use checkout.catalog_type to specify FNF or Marketplace basket.',
  inputSchema: InputSchema,

  async execute(rawArgs, ctx) {
    const args = InputSchema.parse(rawArgs);
    const contextType = args.checkout?.catalog_type ?? 'FNF';

    const result = await ctx.gql<GqlBasketResponse>(GET_BASKET_QUERY, {
      basketContexts: [{ type: contextType, primary: true }],
    });

    const basket = result.data.basket;
    if (!basket) throw new Error('Basket query returned empty response');

    const messages = toUcpMessages(basket);

    return {
      ...UCP_META,
      checkout: toUcpCheckout(basket),
      ...(messages.length > 0 && { messages }),
    };
  },
};
