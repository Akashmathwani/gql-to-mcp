// src/tools/ucp/checkout/queries.ts

export const UPDATE_BASKET_MUTATION = /* GraphQL */ `
  mutation UpdateItems($items: [BasketLineItemInputType], $basketContexts: [BasketContextType]) {
    basket(items: $items, basketContexts: $basketContexts) {
      guidePrice
      savings
      items {
        quantity
        cost
        unit
        product {
          id
          title
          defaultImageUrl
          isForSale
          status
          price {
            price: actual
            unitPrice
            unitOfMeasure
          }
        }
      }
      promotions {
        promotionId: id
        offerText: description
      }
      charges {
        surcharge
        minimumBasketValue: minimum
        bagCharge
      }
      clubcardPoints {
        totalPoints: total
      }
    }
  }
`;

export const GET_BASKET_QUERY = /* GraphQL */ `
  query GetBasket($basketContexts: [BasketContextType]) {
    basket(basketContexts: $basketContexts) {
      guidePrice
      savings
      items {
        quantity
        cost
        unit
        product {
          id
          title
          defaultImageUrl
          isForSale
          status
          price {
            price: actual
            unitPrice
            unitOfMeasure
          }
        }
      }
      promotions {
        promotionId: id
        offerText: description
      }
      charges {
        surcharge
        minimumBasketValue: minimum
        bagCharge
      }
      clubcardPoints {
        totalPoints: total
      }
    }
  }
`;
