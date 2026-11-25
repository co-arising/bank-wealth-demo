import example.bankwealth.application.services.{BankPersistenceIds, BankRequestIdentity}
import example.bankwealth.domain.services.impl.BankBalanceComputations
import example.bankwealth.infrastructure.bootstrap.BankActorHandle
import example.bankwealth.infrastructure.persistence.BankPersistenceJournal
import example.bankwealth.infrastructure.security.{BankSeed, BankSeedAuthority}
import akka.actor.typed.ActorSystem
import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.persistence.query.PersistenceQuery
import akka.persistence.testkit.query.scaladsl.PersistenceTestKitReadJournal
import akka.actor.typed.scaladsl.AskPattern._
import akka.util.Timeout
import com.typesafe.config.ConfigFactory
import example.bankwealth.domain._
import example.bankwealth.domain.values._
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.{Await, Future}
import scala.concurrent.duration._

final class BankSeedAuthoritySpec extends AnyFunSuite {
  UnitConfigurationCheck.main(Array.empty)
  test("seed checks original PB and never credits again after the balance changes") {
    val kit = ActorTestKit(ConfigFactory.load())
    implicit val system: ActorSystem[_] = kit.system
    implicit val timeout: Timeout = Timeout(3.seconds)
    val ids = new BankPersistenceIds("seedcheck")
    val id = AccountId("investor")
    val query = PersistenceQuery(system).readJournalFor[PersistenceTestKitReadJournal]("akka.persistence.testkit.query")
    val journal = new BankPersistenceJournal("seedcheck", query, () => query.currentPersistenceIds(None, Long.MaxValue))
    def await[A](f: Future[A]): A = Await.result(f, 5.seconds)
    try {
      val actor = kit.spawn(CreditBalanceAggregate(ids.account(id), CreditBalanceState.empty.copy(id = id), BankBalanceComputations))
      val handle = BankActorHandle(ids.account(id), actor)
      val seeds = new BankSeedAuthority(journal)
      val seed = BankSeed(id, "CNY", Money.create(BigDecimal("1000.00"), "CNY").fold(e => throw new IllegalArgumentException(e.message), identity))
      await(seeds.ensure(seed, handle))
      val before = await(journal.currentEvents(handle.persistenceId, 0L))
      assert(before.size == 1)
      await(seeds.ensure(seed, handle))
      assert(await(journal.currentEvents(handle.persistenceId, 0L)).size == 1)
      val accepted = await(actor.ask[CreditBalanceAggregate.Reply](r => CreditBalanceAggregate.Execute(CreditBalanceProtocol.ReserveFunds(TxId("buy"), id, Money.create(BigDecimal("100.00"), "CNY").fold(e => throw new IllegalArgumentException(e.message), identity)), r)))
      assert(accepted.isInstanceOf[CreditBalanceAggregate.Accepted])
      await(seeds.ensure(seed, handle))
      assert(await(journal.currentEvents(handle.persistenceId, 0L)).size == 2)
      val state = await(actor.ask[CreditBalanceState](CreditBalanceAggregate.GetState))
      assert(state.accountBalance("CNY") == Money.create(BigDecimal("900.00"), "CNY").fold(e => throw new IllegalArgumentException(e.message), identity))
      intercept[IllegalArgumentException](await(seeds.ensure(seed.copy(amount = Money.create(BigDecimal("900.00"), "CNY").fold(e => throw new IllegalArgumentException(e.message), identity)), handle)))
      assert(await(journal.currentEvents(handle.persistenceId, 0L)).size == 2)
      kit.stop(actor)
      val recovered = kit.spawn(CreditBalanceAggregate(ids.account(id), CreditBalanceState.empty.copy(id = id), BankBalanceComputations))
      await(seeds.ensure(seed, BankActorHandle(ids.account(id), recovered)))
      assert(await(recovered.ask[CreditBalanceState](CreditBalanceAggregate.GetState)).accountBalance("CNY") == Money.create(BigDecimal("900.00"), "CNY").fold(e => throw new IllegalArgumentException(e.message), identity))
    } finally { journal.close(); kit.shutdownTestKit() }
  }

  test("request identities bind principal and client key without amount or ambiguous concatenation") {
    assert(BankRequestIdentity.order("ab", "c") != BankRequestIdentity.order("a", "bc"))
    assert(BankRequestIdentity.order("alice", "same") != BankRequestIdentity.order("bob", "same"))
    assert(BankRequestIdentity.order("alice", "same") == BankRequestIdentity.order("alice", "same"))
    val ids = new BankPersistenceIds("local")
    assert(ids.owns(ids.order(FundOrderId("a/b"))))
    assert(!ids.owns("local-other/order/a"))
  }
}
