# Sandwich Context Pack — `fund-order-confirm-tashares` (`FundOrder.ConfirmTAShares`)

- **Layer**: `domain` | **Tier**: `L2` (QF_NIA) | **HitPolicy**: `FIRST`
- **Canonical SHA-256**: `2d270cec2cebea6d`
- **Editable @cloze Slot**: `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/v2-pilot/handwritten/fund-order-confirm-tashares.cloze.ts` lines `12..14`

## 1. Top Bread — Closed-Over Types & Signatures

- Exact Types: `AmountDecimal(scale=2)`, `NavDecimal(scale=4)`, `Money(scale=2)`
- Value Objects: (none)
- Aggregate `FundOrder` State Fields: `netAmount: AmountDecimal`, `paymentOutcome: String`, `taStatus: String`


## 2. Middle — Authoritative EARS Contract & Caller Guarantees


| Order | Rule ID | Command / Operation | Required Outcome |
| --- | --- | --- | --- |
| 0 | `TA_INVALID_NAV` | `RecordFundTAConfirmed` | reject TA_INVALID_NAV |
| 1 | `TA_SHARES_MISMATCH` | `RecordFundTAConfirmed` | reject TA_SHARES_MISMATCH |
| 2 | `TA_PAYMENT_NOT_SUCCEEDED` | `RecordFundTAConfirmed` | reject TA_PAYMENT_NOT_SUCCEEDED |
| 3 | `TA_ALREADY_CONFIRMED` | `RecordFundTAConfirmed` | reject TA_ALREADY_CONFIRMED |
| 4 | `TA_CONFIRMED` | `RecordFundTAConfirmed` | transition -> confirmed and emit FundTASharesConfirmed |

## 3. Bottom Bread — Locked @CoArisingSpec Acceptance Oracles

- `@CoArisingSpec(id="TA_INVALID_NAV")` — `RecordFundTAConfirmed` → reject TA_INVALID_NAV (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="TA_SHARES_MISMATCH")` — `RecordFundTAConfirmed` → reject TA_SHARES_MISMATCH (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="TA_PAYMENT_NOT_SUCCEEDED")` — `RecordFundTAConfirmed` → reject TA_PAYMENT_NOT_SUCCEEDED (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="TA_ALREADY_CONFIRMED")` — `RecordFundTAConfirmed` → reject TA_ALREADY_CONFIRMED (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="TA_CONFIRMED")` — `RecordFundTAConfirmed` → transition -> confirmed and emit FundTASharesConfirmed (primary + anti-hardcoding secondary witness)
