package example.bankwealth.domain.services.impl

import example.bankwealth.domain.entities.CreditBalanceEntity
import example.bankwealth.domain.invariants.params.CreditBalanceRuleParams._
import example.bankwealth.domain.services.CreditBalanceComputations
import example.bankwealth.domain.values.Money
import net.imadz.common.CommonTypes.iMadzError
import scala.util.Try

object BankBalanceComputations extends CreditBalanceComputations {
  private def available(state: CreditBalanceEntity.State, currency: String): Either[iMadzError, Money] =
    state.accountBalance
      .get(currency)
      .toRight(iMadzError("LEDGER_CURRENCY_UNINITIALIZED", "initialized currency balance required"))

  private def safeMoney(op: => Money): Either[iMadzError, Money] =
    Try(op).toEither.left.map(e => iMadzError("LEDGER_ARITHMETIC", Option(e.getMessage).getOrElse("balance arithmetic error")))

  def balanceAfterReserveFunds(state: CreditBalanceEntity.State, p: ReserveFundsParams): Either[iMadzError, Money] =
    available(state, p.amount.currency).flatMap(bal => safeMoney(bal.minus(p.amount)))

  def balanceAfterCommitIncomingCredits(state: CreditBalanceEntity.State, p: CommitIncomingCreditsParams): Either[iMadzError, Money] =
    available(state, p.amount.currency).flatMap(bal => safeMoney(bal.plus(p.amount)))

  def balanceAfterReleaseReservedFunds(state: CreditBalanceEntity.State, p: ReleaseReservedFundsParams): Either[iMadzError, Money] =
    available(state, p.amount.currency).flatMap { bal =>
      state.reservedAmount.get(p.txid) match {
        case Some(reserved) => safeMoney(bal.plus(reserved))
        case None => Right(bal)
      }
    }
}
