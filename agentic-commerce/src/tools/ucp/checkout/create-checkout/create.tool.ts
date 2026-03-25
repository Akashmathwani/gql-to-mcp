import { z } from 'zod';
import type { CustomTool } from 'gql-to-mcp';
import { deriveBasketContext } from '../basket-context';
import { toUcpCheckout, toUcpMessages } from '../mapper';
import { UPDATE_BASKET_MUTATION } from '../queries';
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

  checkout: z.object({
    line_items: z
      .array(
        z.object({
          item: z.object({
            id: z.string().describe('Variant ID from search_catalog or lookup_catalog (TPNC)'),
          }),
          quantity: z.number().int().min(1).max(99),
        })
      )
      .min(1)
      .max(50),
  }),
});

export const createCheckout: CustomTool = {
  name: 'create_checkout',
  authMode: 'jwt',
  description:
    'Add items to the Tesco basket and create a checkout session. ' +
    'Pass variant IDs from search_catalog or lookup_catalog as line_items[].item.id. ' +
    'Automatically detects whether items are F&F or Marketplace. ' +
    'All items in one request must be the same type — do not mix F&F and Marketplace items. ' +
    'Returns the current basket state with totals and line items.',
  inputSchema: InputSchema,

  async execute(rawArgs, ctx) {
    const args = InputSchema.parse(rawArgs);
    const { line_items } = args.checkout;

    console.log(args);
    console.log(line_items);
    const tpncs = line_items.map((li) => li.item.id);

    // Derive basketContext from product __typename — FNFProduct → FNF, MPProduct → MARKETPLACE
    const contextType = await deriveBasketContext(tpncs, ctx);
    console.log(`Deriving basket context from ${tpncs.join(', ')}: ${contextType}`);

    const result = await ctx.gql<GqlBasketResponse>(UPDATE_BASKET_MUTATION, {
      items: line_items.map((li) => ({ id: parseInt(li.item.id, 10), value: li.quantity })),
      basketContexts: [{ type: contextType, primary: true }],
    });

    const basket = result.data.basket;
    if (!basket) throw new Error('Basket mutation returned empty response');

    const messages = toUcpMessages(basket);

    return {
      ...UCP_META,
      checkout: toUcpCheckout(basket),
      ...(messages.length > 0 && { messages }),
    };
  },
};
