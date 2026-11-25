package example.bankwealth.bindings

import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.util.Base64
import example.bankwealth.domain.entities.SipPlanEntity
import example.bankwealth.domain.invariants.params.SipPlanRuleParams._
import example.bankwealth.domain.services.SipPlanComputations
import example.bankwealth.interfaces.api.ApiAcknowledgements._
import example.bankwealth.interfaces.api.ApiCommands._
import example.bankwealth.interfaces.api.ApiKeys._
import example.bankwealth.interfaces.api.ApiResponses._
import example.bankwealth.interfaces.api.ApiWire._
import example.bankwealth.application.readmodels.ReadModelViews._
import example.bankwealth.application.process.protocol._
import example.bankwealth.application.process.protocol.BankPaymentMessages._
import example.bankwealth.application.process.protocol.BankRefundMessages._
import example.bankwealth.application.connectors._
import example.bankwealth.application.connectors.BankSipDispatchProtocol._
import example.bankwealth.application.connectors.BankTaEffectProtocol._
import example.bankwealth.domain.values._

object StableSipIdentity extends SipPlanComputations {
  private def component(value: String): Array[Byte] = {
    val bytes = value.getBytes(StandardCharsets.UTF_8)
    ByteBuffer.allocate(4 + bytes.length).putInt(bytes.length).put(bytes).array()
  }

  def stableSipOccurrence(state: SipPlanEntity.State, p: TriggerSipInstallmentParams): SipOccurrence = {
    require(state.id.value.nonEmpty && p.revision.value.nonEmpty && p.dueSlot >= 0,
      "retained plan/revision/due-slot identity required")
    val bytes = component(state.id.value) ++ component(p.revision.value) ++ ByteBuffer.allocate(8).putLong(p.dueSlot).array()
    val identity = Base64.getUrlEncoder.withoutPadding.encodeToString(bytes)
    SipOccurrence(state.id, p.revision, p.dueSlot, OccurrenceId("sip-occurrence-v1/" + identity),
      OperationId("sip-payment-v1/" + identity), FundOrderId("sip-order-v1/" + identity), p.config)
  }
}
