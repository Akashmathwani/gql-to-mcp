// GraphQL query for fetching loyalty vouchers

export const GET_VOUCHERS_QUERY = /* GraphQL */ `
  query GetVouchers(
    $business: String
    $region: String
    $language: String
    $application: String
    $channel: ChannelType
    $filters: LoyaltyVoucherFiltersInput
    $detailsFilters: LoyaltyVoucherDetailsFiltersInput
  ) {
    loyalty(
      business: $business
      region: $region
      language: $language
      application: $application
      channel: $channel
    ) {
      vouchers(filters: $filters) {
        summary {
          available
          issued
          spent
        }
        list(filters: $detailsFilters) {
          id
          description
          validFrom
          expiryDate
          state
          scannableCode
          redemptionsLeft
          maxRedemptionsLimit
          type
          value
          keyInCode
          redemptionDetails {
            id
            redeemedOn
            type
            location
            locationId
            locationUuid
          }
        }
      }
      vouchersTotalValue
      currency {
        iso
        symbol
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
