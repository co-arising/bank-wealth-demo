package example.bankwealth.bindings

import example.bankwealth.domain.entities.CreditBalanceEntity
import example.bankwealth.domain.invariants.params.CreditBalanceRuleParams._
import example.bankwealth.domain.services.CreditBalanceComputations
import example.bankwealth.domain.values.Money

object BankBalanceComputations extends CreditBalanceComputations {
  private def available(state: CreditBalanceEntity.State, currency: String): Money =
    state.accountBalance.getOrElse(currency, throw new IllegalArgumentException("initialized currency balance required"))

  def balanceAfterReserveFunds(state: CreditBalanceEntity.State, p: ReserveFundsParams): Money =
    available(state, p.amount.currency).minus(p.amount)

  def balanceAfterCommitIncomingCredits(state: CreditBalanceEntity.State, p: CommitIncomingCreditsParams): Money =
    available(state, p.amount.currency).plus(p.amount)

  def balanceAfterReleaseReservedFunds(state: CreditBalanceEntity.State, p: ReleaseReservedFundsParams): Money =
    state.reservedAmount.get(p.txid) match {
      case Some(reserved) => available(state, p.amount.currency).plus(reserved)
      case None => available(state, p.amount.currency)
    }
}
