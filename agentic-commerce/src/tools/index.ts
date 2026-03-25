import type { CustomTool } from 'gql-to-mcp';
import { searchCatalog } from './ucp/catalog/tool';
import { lookupCatalog } from './ucp/lookup/tool';

import { createCheckout, updateCheckout, getCheckout } from './ucp/checkout/index';

export const allTools: CustomTool[] = [
  // Catalog — anonymous
  searchCatalog,
  lookupCatalog,
  // Checkout — jwt
  createCheckout,
  updateCheckout,
  getCheckout,
];
