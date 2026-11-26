# Sandwich Context Pack — `ta-bridge-settlement` (`TaBridgeSettlement`)

- **Layer**: `application` | **Tier**: `L3` (QF_AUFLIA) | **HitPolicy**: `FIRST`
- **Canonical SHA-256**: `bd771c3c94c5356f`
- **Editable @cloze Slot**: `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/v2-pilot/handwritten/ta-bridge-settlement.cloze.ts` lines `11..48`

## 1. Top Bread — Closed-Over Types & Signatures

- Exact Types: `AmountDecimal(scale=2)`, `NavDecimal(scale=4)`, `Money(scale=2)`
- Value Objects: (none)

- Story `TaBridgeSettlement` Dispatches: `FundOrder.RecordFundTAConfirmed`, `FundOrder.RequestIndependentRefund`

## 2. Middle — Authoritative EARS Contract & Caller Guarantees

- **@caller Contract**: `{"idempotencyKey":"(orderId, taSubmissionId)","retryPolicy":"three-phase-reconcile; unknown timeout must NEVER trigger blind refund without taAbsenceConfirmed","forbiddenUntrustedFields":["fundCollectionAccountId","investorAccountId"]}`
- **Extern Predicates**: `submissionPinned(orderId)`, `taReceiptAuthentic(orderId)`, `taOutcomeConfirmed(orderId)`, `taOutcomeRejected(orderId)`, `taAbsenceConfirmed(orderId)`

| Order | Rule ID | Command / Operation | Required Outcome |
| --- | --- | --- | --- |
| 0 | `TA-BR-01` | `BankTaBridgePort.ingestOutcome` | reject TA_UNKNOWN_ORIGINAL |
| 1 | `TA-BR-02` | `BankTaBridgePort.ingestOutcome` | reject TA_INVALID_RECEIPT |
| 2 | `TA-BR-03` | `BankTaBridgePort.ingestOutcome` | dispatch FundOrder.RecordFundTAConfirmed and forbid dispatch FundOrder.RequestIndependentRefund and respond TaBridgeAcknowledgement |
| 3 | `TA-BR-04` | `BankTaBridgePort.ingestOutcome` | dispatch FundOrder.RequestIndependentRefund and forbid dispatch FundOrder.RecordFundTAConfirmed and respond TaBridgeAcknowledgement |
| 4 | `TA-BR-05` | `BankTaBridgePort.ingestOutcome` | respond TaBridgeAcknowledgement and forbid dispatch FundOrder.RequestIndependentRefund and forbid dispatch FundOrder.RecordFundTAConfirmed |

## 3. Bottom Bread — Locked @CoArisingSpec Acceptance Oracles

- `@CoArisingSpec(id="TA-BR-01")` — `BankTaBridgePort.ingestOutcome` → reject TA_UNKNOWN_ORIGINAL (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="TA-BR-02")` — `BankTaBridgePort.ingestOutcome` → reject TA_INVALID_RECEIPT (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="TA-BR-03")` — `BankTaBridgePort.ingestOutcome` → dispatch FundOrder.RecordFundTAConfirmed and forbid dispatch FundOrder.RequestIndependentRefund and respond TaBridgeAcknowledgement (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="TA-BR-04")` — `BankTaBridgePort.ingestOutcome` → dispatch FundOrder.RequestIndependentRefund and forbid dispatch FundOrder.RecordFundTAConfirmed and respond TaBridgeAcknowledgement (primary + anti-hardcoding secondary witness)
- `@CoArisingSpec(id="TA-BR-05")` — `BankTaBridgePort.ingestOutcome` → respond TaBridgeAcknowledgement and forbid dispatch FundOrder.RequestIndependentRefund and forbid dispatch FundOrder.RecordFundTAConfirmed (primary + anti-hardcoding secondary witness)
