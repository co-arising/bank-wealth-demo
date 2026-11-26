# Sandwich Context Pack — `cash-fund-purchase` (`CashFundPurchase`)

- **Layer**: `application` | **Tier**: `L3` (QF_AUFLIA) | **HitPolicy**: `FIRST`
- **Canonical SHA-256**: `2d270cec2cebea6d`
- **Editable @cloze Slot**: `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/v2-pilot/handwritten/cash-fund-purchase.cloze.ts` lines `11..14`

## 1. Top Bread — Closed-Over Types & Signatures

- Exact Types: `AmountDecimal(scale=2)`, `NavDecimal(scale=4)`, `Money(scale=2)`
- Value Objects: (none)

- Story `CashFundPurchase` Dispatches: `FundOrder.RecordCashRequestSource`, `FundOrder.RequestFundPurchaseSettlement`

## 2. Middle — Authoritative EARS Contract & Caller Guarantees

- **@caller Contract**: `{"idempotencyKey":"(principal, clientRequestId)","retryPolicy":"at-least-once safe; replayed identical payload must never re-dispatch settlement","forbiddenUntrustedFields":["operationId","investorAccountId","fundCollectionAccountId"]}`
- **Extern Predicates**: `sessionAuthenticated(principal)`, `originAndCsrfValid()`, `fundCodeActive(fundCode)`, `requestExists(principal, clientRequestId)`, `payloadMatchesOriginal(principal, clientRequestId, fundCode, amount)`

| Order | Rule ID | Command / Operation | Required Outcome |
| --- | --- | --- | --- |
| 0 | `US-CFP-01` | `BankCashSubmitPort.submit` | reject UNAUTHORIZED_OR_CSRF |
| 1 | `US-CFP-02` | `BankCashSubmitPort.submit` | reject INVALID_CASH_SUBMIT |
| 2 | `US-CFP-03` | `BankCashSubmitPort.submit` | pin BankCashOriginal and dispatch FundOrder.RecordCashRequestSource and dispatch FundOrder.RequestFundPurchaseSettlement and respond BankCashAcknowledgement |
| 3 | `US-CFP-04` | `BankCashSubmitPort.submit` | respond BankCashAcknowledgement and forbid dispatch FundOrder.RequestFundPurchaseSettlement |
| 4 | `US-CFP-05` | `BankCashSubmitPort.submit` | reject CASH_SOURCE_CONFLICT |
| 5 | `US-CFP-06` | `BankOrderQuery.get` | expose bank-order-view |
| 6 | `US-CFP-07` | `BankOrderQuery.get` | expose bank-order-view |
| 7 | `US-CFP-08` | `BankOrderQuery.get` | expose bank-order-view |

## 3. Bottom Bread — Locked @CoArisingSpec Acceptance Oracles

- `@CoArisingSpec(id="US-CFP-01")` — `BankCashSubmitPort.submit` → reject UNAUTHORIZED_OR_CSRF (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="US-CFP-02")` — `BankCashSubmitPort.submit` → reject INVALID_CASH_SUBMIT (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="US-CFP-03")` — `BankCashSubmitPort.submit` → pin BankCashOriginal and dispatch FundOrder.RecordCashRequestSource and dispatch FundOrder.RequestFundPurchaseSettlement and respond BankCashAcknowledgement (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="US-CFP-04")` — `BankCashSubmitPort.submit` → respond BankCashAcknowledgement and forbid dispatch FundOrder.RequestFundPurchaseSettlement (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="US-CFP-05")` — `BankCashSubmitPort.submit` → reject CASH_SOURCE_CONFLICT (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="US-CFP-06")` — `BankOrderQuery.get` → expose bank-order-view (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="US-CFP-07")` — `BankOrderQuery.get` → expose bank-order-view (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="US-CFP-08")` — `BankOrderQuery.get` → expose bank-order-view (primary + anti-hardcoding secondary witness)
