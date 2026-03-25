// src/tools/ucp/catalog/types.ts
// GQL response types for both search and browse queries.
// Update here if queries change. Do NOT put UCP output types here.

export type GqlPromotion = {
  promotionId?: string | null;
  offerText?: string | null;
};

export type GqlReviews = {
  stats?: {
    noOfReviews?: number | null;
    overallRating?: number | null;
    overallRatingRange?: number | null;
  } | null;
};

export type GqlVariationProduct = {
  id?: string | null;
  defaultImageUrl?: string | null;
  variationAttributes?: Array<{
    attributeGroup?: string | null; // e.g. 'colour', 'size'
    attributeGroupData?: {
      // single object, NOT an array
      name?: string | null;
      value?: string | null;
      attributes?: Array<{
        name?: string | null;
        value?: string | null;
      } | null> | null;
    } | null;
  } | null> | null;
};

export type GqlVariations = {
  products?: Array<GqlVariationProduct | null> | null;
  priceRange?: {
    minPrice?: number | null;
    maxPrice?: number | null;
  } | null;
};

export type GqlSeller = {
  id?: string | null;
  name?: string | null;
};

export type GqlProductItem = {
  id?: string | null;
  title?: string | null;
  shortDescription?: string | null;
  defaultImageUrl?: string | null;
  brandName?: string | null;
  isForSale?: boolean | null;
  status?: string | null;
  price?: {
    price?: number | null;
    unitPrice?: number | null;
    unitOfMeasure?: string | null;
  } | null;
  promotions?: Array<GqlPromotion | null> | null;
  reviews?: GqlReviews | null;
  variations?: GqlVariations | null;
  seller?: GqlSeller | null;
};

export type GqlPageInfo = {
  totalCount?: number | null;
  pageNo?: number | null;
  count?: number | null;
  pageSize?: number | null;
  offset?: number | null;
};

// search query response
export type GqlSearchResponse = {
  search?: {
    pageInformation?: GqlPageInfo | null;
    productItems?: Array<GqlProductItem | null> | null;
  } | null;
};

// browse/category query response — same product shape, different root field
export type GqlBrowseResponse = {
  category?: {
    pageInformation?: GqlPageInfo | null;
    productItems?: Array<GqlProductItem | null> | null;
  } | null;
};
