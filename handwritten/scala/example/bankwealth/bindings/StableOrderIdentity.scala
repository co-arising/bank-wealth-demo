package example.bankwealth.bindings

import example.bankwealth.domain.entities.FundOrderEntity
import example.bankwealth.domain.invariants.params.FundOrderRuleParams._
import example.bankwealth.domain.services.FundOrderComputations
import example.bankwealth.domain.values.{OperationId, TaRequestId}
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.util.Base64

object StableOrderIdentity extends FundOrderComputations {
  private def identity(parts: String*): String = {
    val bytes = parts.foldLeft(Array.emptyByteArray) { (all, part) =>
      require(part != null && part.nonEmpty, "retained order identity required")
      val value = part.getBytes(StandardCharsets.UTF_8)
      all ++ ByteBuffer.allocate(4 + value.length).putInt(value.length).put(value).array()
    }
    Base64.getUrlEncoder.withoutPadding.encodeToString(bytes)
  }
  def StableTaRequestId(state: FundOrderEntity.State, p: RegisterFundTASubmissionParams): TaRequestId =
    TaRequestId("bank-ta-v1/" + identity(p.fundOrderId.value, p.paymentTxId.value))
  def StableRefundOperationId(state: FundOrderEntity.State, p: RequestFundPurchaseRefundParams): OperationId =
    OperationId("bank-refund-v1/" + identity(p.fundOrderId.value, p.paymentTxId.value))
}
