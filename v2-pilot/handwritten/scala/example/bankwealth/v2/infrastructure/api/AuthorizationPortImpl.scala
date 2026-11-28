// @knowledge source:bank-wealth/bankwealth#/service/authorization-port
package example.bankwealth.v2.infrastructure.api

import javax.inject.{Inject, Singleton}
import example.bankwealth.v2.interfaces.api.{AuthorizationPort, AuthzDecisionQuery}

/** Default fail-closed external PDP adapter; replace with real policy engine client for external-pdp routes. */
@Singleton
final class AuthorizationPortImpl @Inject()() extends AuthorizationPort {
  override def decide(query: AuthzDecisionQuery): Boolean = false
}
