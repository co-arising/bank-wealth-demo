// Handwritten isolation-zone @cloze implementation for FundOrder.ConfirmTAShares (L2 / QF_NIA)
// Edit ONLY inside the bounded @cloze slot "fund-order-confirm-tashares" below.
package example.bankwealth.v2

object FundOrderConfirmTASharesCloze extends FundOrderClozeHandlers {
  override def recordFundTAConfirmed(state: FundOrderState, cmd: RecordFundTAConfirmed): Either[DomainRejection, CommandAccepted[FundOrderEvent]] = {
    // @cloze:start(fund-order-confirm-tashares)
    if (cmd.nav <= BigDecimal("0.0000")) {
      Left(DomainRejection("TA_INVALID_NAV", "TA_INVALID_NAV"))
    } else {
      val exactFloor = cmd.shares >= 0L &&
        (BigDecimal(cmd.shares) * cmd.nav <= state.netAmount) &&
        ((BigDecimal(cmd.shares) + BigDecimal(1)) * cmd.nav > state.netAmount)
      if (!exactFloor) {
        Left(DomainRejection("TA_SHARES_MISMATCH", "TA_SHARES_MISMATCH"))
      } else if (state.paymentOutcome != "succeeded") {
        Left(DomainRejection("TA_PAYMENT_NOT_SUCCEEDED", "TA_PAYMENT_NOT_SUCCEEDED"))
      } else if (state.taStatus == "confirmed") {
        Left(DomainRejection("TA_ALREADY_CONFIRMED", "TA_ALREADY_CONFIRMED"))
      } else {
        Right(CommandAccepted(Seq(FundTASharesConfirmed(cmd.shares, cmd.nav)), "TA_CONFIRMED"))
      }
    }
    // @cloze:end(fund-order-confirm-tashares)
  }
}
