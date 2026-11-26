// Handwritten isolation-zone @cloze implementation for application story TaBridgeSettlement
// Edit ONLY inside the bounded @cloze slot "ta-bridge-settlement" below.
package example.bankwealth.v2

object TaBridgeSettlementCloze extends TaBridgeSettlementHandler {
  override def handle(req: TaBridgeSettlementRequest, externs: TaBridgeSettlementExternPorts, effects: TaBridgeSettlementEffectsPort): Either[DomainRejection, TaBridgeSettlementSuccessResponse] = {
    // @cloze:start(ta-bridge-settlement)
    val orderId = req.payload.getOrElse("orderId", "")
    if (!externs.submissionPinned(orderId)) {
      Left(DomainRejection("TA_UNKNOWN_ORIGINAL", "TA-BR-01"))
    } else if (!externs.taReceiptAuthentic(orderId)) {
      Left(DomainRejection("TA_INVALID_RECEIPT", "TA-BR-02"))
    } else {
      val sanitized: Map[String, Any] = Map("orderId" -> orderId)
      if (externs.taOutcomeConfirmed(orderId)) {
        effects.dispatch("FundOrder.RecordFundTAConfirmed", sanitized)
        Right(TaBridgeSettlementSuccessResponse(
          ruleId = "TA-BR-03",
          responseType = Some("TaBridgeAcknowledgement"),
          response = Map("state" -> "confirmed")
        ))
      } else if (externs.taOutcomeRejected(orderId) || externs.taAbsenceConfirmed(orderId)) {
        effects.dispatch("FundOrder.RequestIndependentRefund", sanitized)
        Right(TaBridgeSettlementSuccessResponse(
          ruleId = "TA-BR-04",
          responseType = Some("TaBridgeAcknowledgement"),
          response = Map("state" -> "refund_dispatched")
        ))
      } else {
        // Timeout / unknown without explicit absence proof: NEVER trigger blind refund ([TA-BR-05])
        Right(TaBridgeSettlementSuccessResponse(
          ruleId = "TA-BR-05",
          responseType = Some("TaBridgeAcknowledgement"),
          response = Map("state" -> "pending_reconcile")
        ))
      }
    }
    // @cloze:end(ta-bridge-settlement)
  }
}
