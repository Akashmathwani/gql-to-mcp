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
            id: z.string().describe('Variant ID (TPNC) of the item to update'),
          }),
          quantity: z
            .number()
            .int()
            .min(0)
            .max(99)
            .describe('New quantity. Pass 0 to remove item.'),
        })
      )
      .min(1)
      .max(50),
  }),
});

export const updateCheckout: CustomTool = {
  name: 'update_checkout',
  authMode: 'jwt',
  description:
    'Update item quantities in the Tesco basket. ' +
    'Pass variant IDs from search_catalog or lookup_catalog as line_items[].item.id. ' +
    'Set quantity to 0 to remove an item from the basket. ' +
    'All items in one request must be the same type — do not mix F&F and Marketplace items. ' +
    'Returns updated basket state with new totals.',
  inputSchema: InputSchema,

  async execute(rawArgs, ctx) {
    const args = InputSchema.parse(rawArgs);
    const { line_items } = args.checkout;
    console.log(line_items);
    // Only derive context for items being added (quantity > 0)
    // Removals (quantity === 0) don't need product type lookup
    const addedTpncs = line_items.filter((li) => li.quantity > 0).map((li) => li.item.id);

    const contextType = addedTpncs.length > 0 ? await deriveBasketContext(addedTpncs, ctx) : 'FNF'; // default for removal-only requests — context needed but items don't matter
    console.log(`Deriving basket context from ${addedTpncs.join(', ')}: ${contextType}`);

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
