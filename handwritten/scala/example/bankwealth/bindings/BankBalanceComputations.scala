package example.bankwealth.bindings

import example.bankwealth.domain.entities.CreditBalanceEntity
import example.bankwealth.domain.events.{CreditBalanceEvents => CreditBalanceProtocol}
import example.bankwealth.domain.services.CreditBalanceComputations
import example.bankwealth.domain.values.Money

object BankBalanceComputations extends CreditBalanceComputations {
  private def available(state: CreditBalanceEntity.State, currency: String): Money =
    state.accountBalance.getOrElse(currency, throw new IllegalArgumentException("initialized currency balance required"))

  def BalanceAfterReserveFunds(state: CreditBalanceEntity.State, p: CreditBalanceProtocol.ReserveFunds): Money =
    available(state, p.amount.currency).minus(p.amount)

  def BalanceAfterCommitIncomingCredits(state: CreditBalanceEntity.State, p: CreditBalanceProtocol.CommitIncomingCredits): Money =
    available(state, p.amount.currency).plus(p.amount)

  def BalanceAfterReleaseReservedFunds(state: CreditBalanceEntity.State, p: CreditBalanceProtocol.ReleaseReservedFunds): Money =
    state.reservedAmount.get(p.txid) match {
      case Some(reserved) => available(state, p.amount.currency).plus(reserved)
      case None => available(state, p.amount.currency)
    }
}
