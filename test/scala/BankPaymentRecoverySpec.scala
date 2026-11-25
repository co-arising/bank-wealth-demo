package example.bankwealth.service

import example.bankwealth.application.services.{BankCashRequests, BankPersistenceIds, BankTrustedAdmission}
import example.bankwealth.infrastructure.bootstrap.BankRuntime
import example.bankwealth.infrastructure.persistence.BankPersistenceJournal
import example.bankwealth.infrastructure.security.{BankDemoConfiguration, BankDemoPrincipal, BankFund, BankSeed, BankSeedAuthority}
import akka.actor.typed.ActorSystem
import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.actor.typed.scaladsl.AskPattern._
import akka.persistence.query.PersistenceQuery
import akka.persistence.testkit.query.scaladsl.PersistenceTestKitReadJournal
import akka.util.Timeout
import com.typesafe.config.ConfigFactory
import example.bankwealth.domain._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.proto._
import net.imadz.infra.saga.strict._
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.{Await, Future}
import scala.concurrent.duration._

final class BankPaymentRecoverySpec extends AnyFunSuite {
  UnitConfigurationCheck.main(Array.empty)
  test("actual runtime starts one payment from retained source and preserves authoritative original lookup") {
    val kit = ActorTestKit(ConfigFactory.load())
    implicit val system: ActorSystem[_] = kit.system
    implicit val timeout: Timeout = Timeout(4.seconds)
    implicit val ec: scala.concurrent.ExecutionContext = system.executionContext
    val query = PersistenceQuery(system).readJournalFor[PersistenceTestKitReadJournal]("akka.persistence.testkit.query")
    val namespace = "runtimepayment"
    val journal = new BankPersistenceJournal(namespace, query, () => query.currentPersistenceIds(None, Long.MaxValue))
    val ids = new BankPersistenceIds(namespace)
    val investor = AccountId("alice"); val collection = AccountId("collection")
    val config = BankDemoConfiguration("v1", "http://127.0.0.1:18081", Vector(BankDemoPrincipal("alice", investor, Set("customer"), "test", "csrf")),
      Vector(BankFund("fund", collection)), Vector(BankSeed(investor, "CNY", Money.create(BigDecimal("1000.00"), "CNY").fold(e => throw new IllegalArgumentException(e.message), identity)), BankSeed(collection, "CNY", Money.create(BigDecimal("0.00"), "CNY").fold(e => throw new IllegalArgumentException(e.message), identity))))
    val admission = new BankTrustedAdmission(config)
    val runtime = new BankRuntime(namespace, journal, new ReconcileAuthorizer {
      def authorize(id: TransactionIdentity, token: String): Either[String,String] = Left("not requested")
    }, _ => throw new AssertionError("TA not part of payment admission test"))
    def await[A](value: Future[A]): A = Await.result(value, 10.seconds)
    try {
      val seeds = new BankSeedAuthority(journal)
      config.seeds.foreach(s => await(runtime.account(s.accountId).flatMap(h => seeds.ensure(s, h))))
      val service = new BankCashRequests(runtime, config, admission, journal)
      val principal = Principal("alice", Set("customer"))
      val request = BankCashSubmit("request", "fund", MoneyWire("10000", "CNY"))
      val original = admission.cash(principal, request).toOption.get
      val handle = await(runtime.order(original.payment.fundOrderId))
      assert(await(handle.ref.ask[FundOrderAggregate.Reply](r => FundOrderAggregate.Execute(FundOrderProtocol.RecordCashRequestSource(original, Some(original)), r))).isInstanceOf[FundOrderAggregate.Accepted])
      assert(await(service.getOriginal(principal,"request")) == Right(original))
      assert(await(service.submit(principal, request)).isRight)
      assert(await(service.submit(principal, request)).isRight)
      assert(await(service.submit(principal, request.copy(amount=MoneyWire("20000","CNY")))) == Left(RequestConflict))
      kit.createTestProbe[Unit]().awaitAssert {
        val state = await(handle.ref.ask[FundOrderState](FundOrderAggregate.GetState))
        assert(state.cashPaymentFinalResults.values.toSet == Set("succeeded"))
      }
      val events = await(journal.readPb(ids.account(investor)))
      assert(events.count(_.isInstanceOf[CreditBalanceReserveFundsConfirmedPB]) == 1)
      assert(events.count(_.isInstanceOf[CreditBalanceDeductFundsConfirmedPB]) == 1)
      assert(await(service.getOriginal(principal,"request")) == Right(original))
      assert(await(runtime.account(investor).flatMap(_.ref.ask[CreditBalanceState](CreditBalanceAggregate.GetState))).accountBalance("CNY") == Money.create(BigDecimal("900.00"),"CNY").fold(e => throw new IllegalArgumentException(e.message), identity))
      assert(await(runtime.account(collection).flatMap(_.ref.ask[CreditBalanceState](CreditBalanceAggregate.GetState))).accountBalance("CNY") == Money.create(BigDecimal("100.00"),"CNY").fold(e => throw new IllegalArgumentException(e.message), identity))
    } finally { runtime.close(); journal.close(); kit.shutdownTestKit() }
  }
}
