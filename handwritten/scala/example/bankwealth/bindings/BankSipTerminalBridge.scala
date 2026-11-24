package example.bankwealth.bindings

import akka.actor.typed.{ActorRef, ActorSystem}
import akka.actor.typed.scaladsl.AskPattern._
import akka.util.Timeout
import example.bankwealth.application.{BankCashPaymentExecution => Cash, BankPaymentHost => PaymentHost,
  BankIndependentRefundExecution => Refund, BankRefundHost => RefundHost}
import example.bankwealth.application.aggregates.{CreditBalanceAggregate, FundOrderAggregate, SipPlanAggregate}
import example.bankwealth.domain.entities.{CreditBalanceEntity, FundOrderEntity, SipPlanEntity}
import example.bankwealth.domain.events.{CreditBalanceEvents => CreditBalanceProtocol, FundOrderEvents => FundOrderProtocol, SipPlanEvents => SipPlanProtocol}
import example.bankwealth.domain.services.{CreditBalanceComputations, FundOrderComputations, SipPlanComputations}
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.proto._
import example.bankwealth.infrastructure.persistence.converters.DomainConverters
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._

/** The caller cannot supply a terminal outcome. It is derived from the original order
  * and its correlated PB evidence, then counted by the generated plan's first-terminal fold.
  */
final class BankSipTerminalBridge(plan: ActorRef[SipPlanAggregate.Request], order: ActorRef[FundOrderAggregate.Request],
    orderPersistenceId: String, readJournal: String => Future[Vector[Any]])(implicit system: ActorSystem[_]) {
  implicit private val ec: ExecutionContext = system.executionContext
  implicit private val timeout: Timeout = Timeout(3.seconds)
  def record(o: SipOccurrence): Future[Unit] = for {
    p <- plan.ask[SipPlanEntity.State](SipPlanAggregate.GetState)
    s <- order.ask[FundOrderEntity.State](FundOrderAggregate.GetState)
    events <- readJournal(orderPersistenceId)
    decodedEvents = events.collect { case raw: FundOrderEventPO => DomainConverters.decodeFundOrderEventPO(raw) }
    _ = require(p.id == o.planId && p.occurrences.get(o.dueSlot).contains(o) && s.id == o.fundOrderId && s.operationId == o.operationId &&
      s.investorAccountId == o.config.investorAccountId && s.fundCollectionAccountId == o.config.fundCollectionAccountId &&
      s.amount == o.config.amount && s.fundCode == o.config.fundCode, "terminal original occurrence association mismatch")
    expectedPayment = TxId(PaymentHost.operationIdentity(Cash.State(Cash.Inputs(o.operationId, o.operationId, o.config.investorAccountId,
      o.fundOrderId, o.config.fundCollectionAccountId, o.config.amount, o.config.fundCode))))
    _ = require(s.selectedPaymentTxId.value.isEmpty || s.selectedPaymentTxId == expectedPayment,
      "terminal selected payment differs from original occurrence")
    paid = s.selectedPaymentTxId == expectedPayment && s.cashPaymentFinalResults.get(expectedPayment).contains("succeeded") && decodedEvents.exists {
      case e: FundOrderProtocol.FundCashPaymentSucceeded => e.txid == expectedPayment
      case _ => false
    }
    confirmation = decodedEvents.collect { case e: FundOrderProtocol.FundTASharesConfirmed => e }.find { e =>
      e.fundOrderId == o.fundOrderId && e.paymentTxId == expectedPayment && e.taRequestId == s.taRequestId &&
        e.taReference == s.taReference && e.fundCode == o.config.fundCode && e.currency == o.config.amount.currency &&
        e.shares == s.taConfirmedShares && s.taReceipts.get(e.receiptId).contains(e.receiptBody)
    }
    taConfirmed = paid && s.taStatus == "confirmed" && confirmation.nonEmpty
    taRejected = paid && s.taStatus == "rejected" && decodedEvents.exists {
      case e: FundOrderProtocol.FundTARejected =>
        e.fundOrderId == o.fundOrderId && e.paymentTxId == expectedPayment && e.taRequestId == s.taRequestId &&
          e.taReference == s.taReference && e.fundCode == o.config.fundCode && e.currency == o.config.amount.currency &&
          e.reason == s.taRejectionReason && s.taReceipts.get(e.receiptId).contains(e.receiptBody)
      case _ => false
    }
    expectedRefundOperation = StableOrderIdentity.StableRefundOperationId(s, FundOrderProtocol.RequestFundPurchaseRefund(o.fundOrderId, expectedPayment))
    expectedRefund = TxId(RefundHost.operationIdentity(Refund.State(Refund.Inputs(o.fundOrderId, expectedPayment,
      o.config.investorAccountId, o.config.fundCollectionAccountId, o.config.amount, expectedRefundOperation))))
    refundRequested = taRejected && s.refundOperationId == expectedRefundOperation && decodedEvents.exists {
      case e: FundOrderProtocol.FundPurchaseRefundRequested =>
        e.fundOrderId == o.fundOrderId && e.paymentTxId == expectedPayment && e.refundOperationId == s.refundOperationId &&
          e.investorAccountId == o.config.investorAccountId && e.fundCollectionAccountId == o.config.fundCollectionAccountId && e.amount == o.config.amount
      case _ => false
    }
    refunded = refundRequested && s.refundOutcome == "succeeded" && s.refundFinalResults.get(expectedRefund).contains("succeeded") && decodedEvents.exists {
      case e: FundOrderProtocol.FundRefundSucceeded =>
        e.refundOperationId == s.refundOperationId && e.refundTxId == expectedRefund && s.refundResultReceipts.get(e.receiptId).contains(e.receiptBody)
      case _ => false
    }
    outcome = if (taConfirmed) Some("ta-confirmed") else if (refunded) Some("ta-rejected-refund-completed")
      else if (s.paymentOutcome == "rejected-before-effects" && s.cashPaymentFinalResults.get(expectedPayment).contains("rejected-before-effects") && decodedEvents.exists {
        case e: FundOrderProtocol.FundCashPaymentRejectedBeforeEffects => e.txid == expectedPayment
        case _ => false
      }) Some("payment-rejected-before-effects")
      else if (s.paymentOutcome == "compensated" && s.cashPaymentFinalResults.get(expectedPayment).contains("compensated") && decodedEvents.exists {
        case e: FundOrderProtocol.FundCashPaymentCompensated => e.txid == expectedPayment
        case _ => false
      }) Some("payment-compensated") else None
    _ = require(p.firstTerminals.get(o.occurrenceId).forall {
      case "succeeded" => taConfirmed
      case "failed" => outcome.exists(_ != "ta-confirmed")
      case _ => false
    }, "retained SIP terminal lacks matching order evidence")
    command: SipPlanProtocol.Command = outcome match {
      case Some("ta-confirmed") => SipPlanProtocol.RecordSipInstallmentSucceeded(o, "ta-confirmed", "bank-sip-terminal-v1/" + o.occurrenceId.value,
        confirmation.get.receiptBody)
      case Some(reason) => SipPlanProtocol.RecordSipInstallmentFailed(o, reason, "bank-sip-terminal-v1/" + o.occurrenceId.value,
        Vector(s.id.value, expectedPayment.value, reason, if (refunded) expectedRefundOperation.value else "",
          if (refunded) expectedRefund.value else "").map(x => x.length.toString + ":" + x).mkString)
      case None if s.cashPaymentResults.get(expectedPayment).contains("outcome-unknown") || s.taStatus == "unknown" || s.refundOutcome == "outcome-unknown" =>
        SipPlanProtocol.RecordSipInstallmentOutcomeUnknown(o)
      case None if s.cashPaymentResults.get(expectedPayment).contains("recovery-required") || s.refundOutcome == "recovery-required" =>
        SipPlanProtocol.RecordSipInstallmentRecoveryRequired(o)
      case None if taRejected => SipPlanProtocol.RecordSipInstallmentRefundInProgress(o)
      case None => SipPlanProtocol.RecordSipInstallmentPending(o)
    }
    // After the first terminal, revalidate evidence but never manufacture a new receipt
    // from a larger set of TA observations. Duplicate notifications produce zero events.
    _ <- if (p.firstTerminals.contains(o.occurrenceId)) Future.successful(()) else
      plan.ask[SipPlanAggregate.Reply](r => SipPlanAggregate.Execute(command, r)).map { reply =>
        require(reply.isInstanceOf[SipPlanAggregate.Accepted], "SIP terminal refused")
      }
  } yield ()
}
