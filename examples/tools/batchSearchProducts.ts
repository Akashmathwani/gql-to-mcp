/**
 * Custom tool: Batch search products with parallel execution
 */

import type { CustomTool } from 'gql-to-mcp';

interface Product {
  id: string;
  title: string;
  description: string;
  defaultImageUrl: string;
  price: {
    actual: number;
    unitOfMeasure: string;
    unitPrice: number;
  };
}

interface SearchResponse {
  search: {
    products: Product[];
  };
}

export const batchSearchProducts: CustomTool = {
  name: 'batchSearchProducts',
  description: 'Search for multiple products using parallel execution',

  inputSchema: {
    type: 'object',
    properties: {
      searchTerms: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of keywords to search for',
      },
    },
    required: ['searchTerms'],
  },

  async execute(args, ctx) {
    const { searchTerms } = args as { searchTerms: string[] };

    const searchQuery = `
      query SearchProducts($query: String!) {
        search(query: $query) {
          products {
            id
            title
            description
            defaultImageUrl
            price {
              actual
              unitOfMeasure
              unitPrice
            }
          }
        }
      }
    `;

    console.log(`[batchSearchProducts] Executing ${searchTerms.length} searches in parallel...`);

    // Execute all searches in parallel
    const promises = searchTerms.map((searchTerm: string) =>
      ctx.gql<SearchResponse>(searchQuery, { query: searchTerm })
    );

    const results = await Promise.all(promises);

    // Combine all products from all searches
    const allProducts = results
      .filter((r) => !r.errors && r.data)
      .flatMap((r) => r.data?.search?.products || []);

    console.log(`[batchSearchProducts] Found ${allProducts.length} total products`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(allProducts, null, 2),
        },
      ],
    };
  },
};
