// GraphQL query for fetching loyalty coupons

export const GET_COUPONS_QUERY = /* GraphQL */ `
  query GetLoyaltyCoupons(
    $business: String
    $region: String
    $language: String
    $application: String
    $channel: ChannelType
  ) {
    loyalty(
      business: $business
      region: $region
      language: $language
      application: $application
      channel: $channel
    ) {
      coupons {
        id
        uuid
        alphaNumericId
        description
        expiry
        canBeActivated
        validFrom
        maxRedemptionsAllowed
        redemptionsLeft
        redemptionDetails {
          redeemedOn
          locationUuid
          storeId
          reference
          description
        }
        promotionId
        value
        classification
        state
        promotionDetails {
          type
          subType
        }
      }
     
      errors {
        name
        message
        status
        code
      }
    }
  }
`;
