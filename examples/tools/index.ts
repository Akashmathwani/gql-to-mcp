/**
 * Custom tools registry
 *
 * Import and export all custom tools here for easy management
 */

import type { CustomTool } from 'gql-to-mcp';

// Import individual tools
import { batchSearchProducts } from './batchSearchProducts';
import { enrichedProductSearch } from './enrichedProductSearch';

// Export all tools as an array
export const customTools: CustomTool[] = [
  batchSearchProducts,
  enrichedProductSearch,
  // Add more tools here as you create them
];

// Also export individually if needed
export { batchSearchProducts, enrichedProductSearch };
