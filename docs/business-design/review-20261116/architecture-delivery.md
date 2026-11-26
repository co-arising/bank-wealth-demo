# 基金购买有界用例与实现交付提案

日期：2026-11-16。视角：虚拟技术架构师、研发负责人、验收测试负责人。
状态：仅模拟业务设计提案；没有真实银行、基金公司、专家或监管人员参与，没有新增政策批准。
本轮只阅读源码、固定测试及指引并保存本文；未执行应用、编译、生成、测试、类型检查或服务验收。
本文不是第二份当前真源、可执行政策、公共schema或会议纪要；后续采纳必须回到唯一作者入口，不能把本文作为运行输入。

## 1. 证据类型与来源坐标

- **F／显式源事实**：作者声明或当前手写实现确有此内容；不等于现实机构规则，也不等于本轮验证通过。
- **M／现有模拟假设**：模拟器硬约束或固定fixture；不能提升为产品计价、交易日历或收费政策。
- **P／角色提案**：下文的用例组织、职责和验收设计，尚未实施；固定测试只读，不随建议改写。
- **Q／未决决定**：明确阻止什么承诺、由谁牵头补什么答案；技术机制不能代替决定。
- **G/H/O**：G为可按已声明语义确定性生成的内容；H为手写实现与接线；O为独立预期数据。三者分别维护，生成测试不能同时充当业务oracle。
- 引用格式 `〔A1:14–20〕` 严格展开为下表A1的**绝对路径:14–20及同行完整SHA-256**；行号均为本轮实际读取的物理文件行号，不引用不存在的展开文件。
- 来源仓HEAD为 `f8ac7ca882335a7c84cff7cbcb5100b6091b864a`；以下文件SHA绑定实际工作树字节，不能仅凭HEAD推定工作树内容或验收状态。

| 编号 | 绝对文件路径 | 来源SHA-256 |
|---|---|---|
| D1 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/AGENTS.md` | `d06ea3445bd1f2e3230c104fe140fb7379d31dd9af018fc03a069fda7731b26c` |
| D2 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/TRUTH.md` | `22ff12d956f30fb46abc5d919255b58f1f1cf3c9be338b4d045e466a1b522520` |
| D3 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/docs/FUND-PURCHASE-BUSINESS-DELIVERY-20261115.md` | `b02e381b853748507e2ea8c4e987fb6913123b57887a2818facb836e8e566ec4` |
| D4 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/use-cases.yaml` | `531663b9e938256b465d3b302a4d5e6798aacb689cd198a795668764aadb3b5e` |
| D5 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/docs/architecture/README.md` | `7dca12c81b97646be967d8c34fa88c25754351d2d787ebddc1949878e44b8074` |
| D6 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/docs/architecture/HANDWRITTEN-SOURCE-MAP.json` | `d1617059b6fc52682d7662015dbdb83fcb4f5aed75d1ff196743cf9c6ec01031` |
| A1 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/record-cash-request-source.slice.yaml` | `55119a58a3440d079af5cc647202fef6e7b3951835a6097950dc34c07fdd3252` |
| A2 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/structures/outgoing-funds.structure.yaml` | `825c0141d95f6a02418424aa8e0d43dd30a5bbae607f6deb5a02efde3effa720` |
| A3 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/request-fund-purchase-settlement.slice.yaml` | `c3dc1fabc62a3fd622933bf01a66859171b5e834319fe62cae7311dfd7dd3e2b` |
| A4 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/sagas/bank-cash-payment-v1.saga.yaml` | `9df6b256506669f8e0f40900bb37cb77696c9f1a17eaa13f229a054d43b2fb0d` |
| A5 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/record-fund-ta-confirmed.slice.yaml` | `5f06801a987491448c7a79c92c314c00b3f71c90eac2425a679ce23276280793` |
| A6 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/request-fund-purchase-refund.slice.yaml` | `6977766c5484f0c003451f5df93102acd3efd6d3102d5d7c14960f66ed6fdfb8` |
| A7 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/trigger-sip-installment.slice.yaml` | `7499c577498e085c8ff8246c5d633ad1c9106df458e219553f5eb9f3000c5419` |
| A8 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/revise-sip-plan.slice.yaml` | `7e1714c020b34d9b9adb8daf93ed91aad9cf953606c6c47c2ad8a8de09d884d8` |
| H1 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankApplicationPorts.scala` | `42e4e0dec4be011379718b6942276b61a9cbb7e026b630071869ee045a3fe632` |
| H2 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankCashRequests.scala` | `21cf50e66468caec589e83a20f5fa92806eb2c52913cfc7016df68f460e0b1d9` |
| H3 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankTrustedAdmission.scala` | `6a861c4f8e6b3920a32136a324506a3b17b0a91a917eefdc48bd332550a4abef` |
| H4 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/ta/BankTaRefundApplication.scala` | `579a2d43451f9c7be63ffd6dbcc156813803664e903ef1b0c03c913648b3719f` |
| H5 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/sip/BankSipApplication.scala` | `fafc993a2854fc00da26b3ddf6171e1c60c256e03e552b9ca7463a20d488dbcf` |
| H6 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/BankTaBridge.scala` | `bf8efecf3f15aca841a6a6ef870de8b1bf7c12269a95c1ce66f2a7e9de1ac7de` |
| H7 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/BankSipTerminalBridge.scala` | `a1cdd34f40425aaa93cf95f86ad2fbaade5893e9d3cbae5263de188576865a6d` |
| H8 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/BankBalanceComputations.scala` | `ceb8afd93202ceb3da389e3e4edc7f612a5512894a9b2af7c55e622874732b3e` |
| H9 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankRecovery.scala` | `b9eecf80581d0a2d3877ff7426c23d37253e63bc46459f4308b91091b4402b2f` |
| H10 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/readside/BankReadside.scala` | `2a51cfa366a21190b0b4d27ac9cc088199ea2804f0769cd4987cebbf9e378f27` |
| H11 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankRequestIdentity.scala` | `41857ea44ad3ddd24b75f9d7199f5f5ae152b90e48840918c9b09130dec84c23` |
| H12 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/StableOrderIdentity.scala` | `ec667552d797dacc85eb8890747b8ae9f08ba9ef3eb0738e815318ce04b5018c` |
| H13 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/StableSipIdentity.scala` | `4a7f9b3a0360879b7ffa7734cb2612b51cfbc85a9a1dcf64441b78f3085a1f67` |
| H14 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/BankTaEffectBindings.scala` | `8e5fe053f57524b8ceda63248d5fafa708eb7ca00e010293f1173a5940959b2c` |
| M1 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/simulator/contract.mjs` | `19d6fa131f05ca23ea01e916c6149f26cc3d78124f0bd555c094d9d4eeee456f` |
| M2 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/simulator/mock-ta-core.mjs` | `a31b1fe4167a61390de36ff1a45e67da0695eaa40b42713c681155e13d71acda` |
| T1 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankSinglePaymentOracleSpec.scala` | `81873a3e8755adacf9a6538065924c4208cb2226dc4c7a5001e094481c6fcc23` |
| T2 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankApplicationAssemblySpec.scala` | `e576ce17ef2f2ea4efac5d5aea9ccf0bfe801b108aabfcc3fe3b9a72ab5aaa3e` |
| T3 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankRequestHttpSpec.scala` | `4070e5f01b080345ea9f9ffbd4c17365c958246bafec8a52767d4885bef12a72` |
| T4 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankTaApplicationSpec.scala` | `bdea46506c840bcc079afcdaf06293122ab500034a0fff49986ca29256355c9f` |
| T5 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankRefundApplicationSpec.scala` | `6beead5ecfad21293d77022d754734b27720774f94a653d1d817a29b3a737acf` |
| T6 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankSipApplicationSpec.scala` | `3b403aba267229602262ea8cbec994d8f9462170602477b1e7bc59d47f3bd390` |
| T7 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankSipStateSpec.scala` | `b728b506b70d0bc24061997b45e853bb6be8fd5442be12e7321c4eaab7668076` |
| T8 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankSipRecoverySpec.scala` | `01b973ba201a47d60b3bcf6b7c9e22845371a736599513347d4b57fa305ee1f2` |
| T9 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankQueryAuthorizationSpec.scala` | `43fb1290ee585bc6338390b46fa562bad37e0abb69698a3519c0330d025b8f82` |
| T10 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankBalanceStateSpec.scala` | `7bf15205d745f7ee146127ef13961c503ad71262091a792ca4f61a1c4f4c568f` |

## 2. 必须读到的实际决定，不由用例标题推断

| 类型 | 已有内容与业务含义 | 精确来源 |
|---|---|---|
| F | 唯一作者入口是根项目配置及当前树；导航steps不构成执行DSL或授权。本文不能反向批准这些叙事。 | 〔D2:5–22；D4:3–8〕 |
| F | `CASH_SOURCE_CONFLICT`先拒绝不同完整来源，`CASH_SOURCE_ONCE`使相同来源空事件成功；首次记录必须在结算前，fold保留完整原文。 | 〔A1:14–20,35–48〕 |
| F | `CASH_ADMITTED_PAYMENT_MATCH`关联已留存付款参数；`ORDER_REPLAY_CONFLICT`先验异文，再由`ORDER_REQUEST_ONCE`幂等返回。 | 〔A3:17–24,63–69〕 |
| F | 出款必须是已初始化的本资源、正CNY；`LEDGER_SUFFICIENT`检查余额；同tx的金额匹配先于“已处理”返回，不能用重复ID吞掉异额。 | 〔A2:15–19,26,127–137〕 |
| F | 预留减少可用额；Deduct清预留并记已出款，不再减第二次余额；Release禁止补偿已commit的出款。 | 〔H8:10–20；A2:47–71,86–112〕 |
| F | 付款三参与者使用同本金，订单commit在募集户commit之后；耐久commit后向前恢复，unknown先核实，结果有五kind。 | 〔A4:11–15,23–65,280–288,337–343〕 |
| F | `TA_PAYMENT/TA_REQUEST/TA_FUND`关联原付款；同receipt正文与outcome须一致；已有终态拒绝新终态。事件实际名为`FundTASharesConfirmed`。 | 〔A5:20–33,58–75〕 |
| F | 聚合只检查份额/NAV文本非空；手写桥另外核正十进制文本、原账户/本金、canonical回执成员资格。不能把聚合guard说成外部真实性认证。 | 〔A5:30；H6:31–34,120–154〕 |
| F | `REFUND_PAYMENT`加`REFUND_TA_REJECTED`允许独立退款；金额/账户取原状态，非客户新输入；`REFUND_INTENT_ONCE`保唯一意图。 | 〔A6:9–17,41–51〕 |
| F | `SIP_OCCURRENCE_REPLAY_CONFLICT`先核原配置；新期次还需封口、未暂停、顺序backlog及有效revision区间，fold才加startCount。 | 〔A7:15–27,54–61〕 |
| F | `SIP_REVISION_FUTURE`要求新生效slot同时大于currentTick和latestEffectiveSlot；旧revision在新生效slot结束，不重写既有occurrence。 | 〔A8:12–21,48–56；H5:89–105〕 |
| F | 有限定投创建要求非空、至多1024个严格递增slot；无首tick暂停会冲突；三次真实付款失败也不自动暂停。 | 〔H3:54–65；T6:316–339〕 |
| M | Mock配置只接受CNY、费用字符串`0`及全本金退款模式；确认份额来自scenario.fixture，不由本金/NAV计算；这些是模拟约束。 | 〔M1:102–145；M2:18–36〕 |
| F | retry/backoff/deadline仍OPEN；文档、模拟器与指定恢复场景不能将其改成已接受的限制或金融服务承诺。 | 〔D1:124–132；D2:26–30〕 |

## 3. P：四个有界用例的可读交付顺序

以下步骤是对已有行为的交付组织提案；“决定依据”引用F/M，未决项不补造默认政策。G/H归属是建议保持的边界，不声称本轮检查了生成目录。

### UC-C：客户现金申购——交付原请求受理与独立的付款结果

前置：可信客户及基金映射、正CNY精确金额、不同出入账户；客户请求不能夹带账户或结果字段。〔H3:10–23；T3:15–21〕
完成条件：客户可以找回同一原请求并分别观察付款、TA、退款；初次`accepted`只证明规定的原请求/启动证据，不保证投资完成。〔H2:22–35,72–87；H10:209–224〕

| 步骤／actor与责任 | 请求、决定和数据 | 事件→状态→回复 | G / H / O |
|---|---|---|---|
| C1 客户表达购买，现金应用负责可信准入 | 收clientRequestId、fundCode、MoneyWire；从principal/配置取得账户及版本；身份不含正文。〔H3:10–23；H11:8–24〕 | 准入失败不进入订单；成功构造完整original，尚无“扣款成功”。 | G：既有载体；H：准入及身份；O：O2、O12 |
| C2 订单负责留存与重复判定 | 同身份同完整original才可重入；不同正文拒绝。〔A1:14–20；H2:25–32〕 | `CashRequestSourceRecorded`→cashRequestSource及originals；此时不把来源记录当付款。 | G：guard/event/fold；H：发送及回读；O：O2 |
| C3 现金应用负责启动原付款 | 用original参数请求结算，确保原父流程，核匹配的耐久RunStarted快照。〔H2:72–87〕 | `FundPurchaseSettlementRequested`→payment-requested；返回原original与accepted。〔A3:45–69；H2:32〕 | G：结算决策/流程合同；H：装配与证据检查；O：O1、O2 |
| C4 两账户及订单负责付款事实 | 预留、募集入款、订单确认按原本金推进；余额不足由账务决定拒绝，不由HTTP提前猜成功。〔A2:127–155；A4:67–247〕 | 资金事件及付款结果分别保留；余额oracle只在对应完成边界核对。 | G：事务/聚合语义；H：phase实现与计算；O：O1、O13 |
| C5 客户读取结果，查询应用负责解释 | 按原请求/订单查询三段状态与水位，不重新启动付款。〔H10:104–108,163–187,209–224〕 | 查询DTO不新增业务事件；付款succeeded和TA confirmed不可合并。 | G：已声明查询基础设施；H：owner/DTO；O：O12 |

替代/失败：同ID改100.00为101.00拒绝，同文重入零新资金效果；HTTP DTO异文与领域原参数异文分别测试。〔T1:194–203；T3:15–21〕
异常交付提案：若来源已存但start/ACK不可得，保留原ID查证后同身份续接；当前应用会回Unavailable，不能把它宣传成“请求一定没发生”。〔H2:25–35,56–61〕
取消边界：本提案不增加客户取消按钮；账务空释放fence已有独立行为，不能由此推定已有客户取消服务。〔A2:86–112,127–137；H1:7–11〕

### UC-T：受信服务推进已付款订单——TA受理与份额确认分开

前置：应用同时核原结算、订单付款确认及付款成功事件；TA场景来自受信配置，不接受客户forced result。〔H4:121–149,185–197；H14:28–48〕

| 步骤／actor与责任 | 决定与数据 | 事件→状态→回复 | G / H / O |
|---|---|---|---|
| T1 TA应用确认是否具备提交资格 | 原orderId/paymentTxId/账户/金额及耐久证据相关；有订单但未付款是无TA动作的Right(Unit)，空历史为MissingResource。〔H4:165–174〕 | 不能从应用调用成功推断已有申购；合格后登记原taRequestId。 | G：登记命令；H：paid证据核对；O：O3前置负例 |
| T2 桥负责提交或查询同一外部请求 | register固定身份，submit发送原正文；reconcile查询原ID并核受信scenario。〔H6:47–83〕 | accepted/unknown可被记录；technical effect confirmed只表示已知提交观察。〔H14:70–75〕 | G：effect协议；H：execute/query/适配；O：O3、O4 |
| T3 入站桥决定回执能否采用 | 必须属于canonical回执，精确匹配本金、账户、基金及交易；保留shares/NAV文本。〔H6:120–162〕 | `FundTASharesConfirmed`→taStatus=confirmed、原份额文本；不是重新估值。〔A5:58–75〕 | G：关联guard/fold；H：权威查询/解码；O：O3 |
| T4 应用交付相关终态 | 核第一相关终态及当前状态；confirmed通知期次桥，rejected转UC-R，accepted/unknown不发终态。〔H4:151–163,226–262〕 | 内部Right(Unit)不承诺客户投资成功；业务成功来自上述确认事实。 | G：领域终态；H：回调与恢复；O：O3、O4、O10 |

失败路线：冲突receipt不覆盖已有正文；错误scenario拒绝；ACK丢失可在业务确认已存而effect尚未checkpoint时继续原图，不能再提交新投资。〔T4:306–334,405–427〕
M边界：`80.0000`和`1.2345`是固定确认文本；本提案不声称它们与100.00本金存在已批准的算术勾稽，也不推导费用或估值收益。〔T4:83–94,320–324；M2:24〕

### UC-R：可信TA拒绝后独立退回原本金

| 步骤／actor与责任 | 决定与数据 | 事件→状态→回复 | G / H / O |
|---|---|---|---|
| R1 TA桥确定退款依据 | 首次退款查询唯一canonical拒绝；若原退款意图已持久，使用它续接而非再造尝试身份。〔H6:84–103〕 | `FundPurchaseRefundRequested`→唯一refundOperationId、pending；原付款成功仍保留。〔A6:41–51；T5:40–43〕 | G：退款guard/event/fold；H：拒绝权威核实；O：O5 |
| R2 退款应用组织反向交易 | 原募集户出、原投资人入、全原本金；核新事务与原paymentTx不同，intent先于装配。〔H4:233–252；T5:33–45〕 | 启动独立parent/Saga，不能补偿原已commit付款。 | G：既有反向协议；H：原图装配；O：O5 |
| R3 应用交付本金返回结果 | 只有匹配refundOutcome、finalResults及退款成功事件才通知terminal。〔H4:253–261〕 | `FundRefundSucceeded`与原付款成功并存；pending/unknown不等于到账。 | G：结果存储；H：交付证据；O：O5、O6 |
| R4 操作员请求既有操作恢复 | 仅operationId；从真实退款/现金/期次原记录找对应交易；客户无此权限。〔H9:55–82〕 | 返回恢复状态，不能由操作员输入新金额或成功标签。 | G：既有恢复协议；H：受信查询/调度；O：O5恢复反例 |

失败路线：退款rejected-before-effects或compensated时本金仍为900.00/100.00，不报已退、不新建第二退款；资金阶段收据丢失保原身份核实。〔T5:72–118,175–215〕
恢复证据要分开：T5的72–118行有测试直接发Reconcile；122–170行另接实际BankRecoveryLoop。不能把前者包装成自动恢复或跨JVM证明。

### UC-S：有限定投创建、未来修订、暂停恢复与逐期结果

| 步骤／actor与责任 | 决定与数据 | 事件→状态→回复 | G / H / O |
|---|---|---|---|
| S1 客户提交有限日程，SIP应用保原意图 | 完整vector与可信账户/版本一起留存，再Create/Append/Seal；按精确位置前缀恢复。〔H3:54–65；H5:89–133〕 | 创建意图、计划、追加、封口事件；accepted不是第一期已扣款。 | G：命令/event/fold；H：完整性及恢复顺序；O：O8 |
| S2 客户只修订未来配置 | owner来自原创建意图；新revision生效slot须满足未来边界，相同revision异正文拒绝。〔H5:72–82,137–152；A8:12–21〕 | `SipPlanRevised`封闭旧区间并记新配置，既有occurrence不改。 | G：区间guard/fold；H：ownership/可信配置；O：O9 |
| S3 操作员推进显式slot | 先预检所有发现计划的tick，再分类与trigger；低tick拒绝，不使用墙钟补期。〔H5:178–202〕 | 时钟/分类事件；`SipInstallmentTriggered`留存occurrence并加startCount。〔A7:48–61〕 | G：时钟/触发决策；H：fanout与原图；O：O7 |
| S4 应用按期派发现金请求 | 校验持久occurrence、revision及触发事件后才装配；前一期派发不可用也尝试下一期，不等TA终态。〔H5:243–298〕 | 原现金流程启动；每期有自己的order/operation，非第二资金引擎。 | G：已声明dispatch；H：发生记录校验及调用；O：O7、O8 |
| S5 客户暂停/恢复 | 使用已持久tick；暂停保旧backlog，分类暂停区间后再resume；未有首tick暂停会冲突。〔H5:155–175,217–236；T6:316–323〕 | 回复paused/active；跳过期次不复活，在途订单不因计划暂停改成撤销。 | G：暂停/跳期命令；H：分类先后；O：O9 |
| S6 终态桥负责相关证据，计划负责首次计数 | 付款成功/accepted/unknown不计成功；TA拒绝须独立退款完成才可计该类失败。〔H7:33–100〕 | 首次相关`SipInstallmentSucceeded/Failed`计数；重复零新计数，三败不自动暂停。〔T6:262–339〕 | G：首次终态guard/fold；H：订单证据桥；O：O10、O11 |

异常路线：仅“slot是vector成员”不足以恢复；错序前缀必须拒绝且不seal、不派发。现有固定测试专门把该责任放在应用层，不允许删成空壳转发。〔T8:83–95；H5:89–105〕
Q边界：slot只作显式模拟业务时标；本文不规定节假日顺延、扣款时刻、自动cron、补扣次数或市场交易日。

## 4. P：按每个行为方法交付BDD，不按接口名凑覆盖

所有行均为待执行场景；O编号见下一节。现有方法范围以〔H1:7–38〕为准，新增场景只能在另获授权的独立手写测试中实现。
公共接口和apply由主集成负责；建议现金、TA退款、SIP、读侧分别有模块owner，验收owner维护独立预期。此处分工不是实际授权实施。

| 方法／建议owner | Given / When / Then及失败路线 | G / H / 独立O与覆盖性质 |
|---|---|---|
| Cash.submit／现金owner | Given本人100.00原请求；When首次及同文重发；Then original相同且仅一次资金效果；改正文拒绝，启动证据不可得不得报付款成功。〔H2:22–35,72–87〕 | G=A1/A3；H=H2/H3；O1/O2。T2测聚合来源，不能冒充submit应用全路径覆盖。 |
| Cash.getOriginal／现金owner | Given本人留存key；When查询；Then返回精确original；无记录MissingResource、非客户NotAuthorized。〔H2:38–53〕 | G=载体；H=权限/查询；新增独立预期按H2分支写，不能拿读侧cashOriginal测试替代。 |
| Cash.submitOccurrence／现金owner | Given已存期次；When同文派发；Then用期次原资金参数；改config或无该期次则Unavailable且不启动。〔H2:64–69〕 | G=结算；H=期次核验；O7及新增逐方法反例，不能用返回Right的假现金引擎证明扣款。 |
| Cash.resumePersisted／现金owner | Given已存完整source而无start；When恢复；Then继续原operation；source不匹配Unavailable；非法来源可能在Future前抛出，需独立锁定调用边界。〔H2:56–61〕 | G=原结算；H=恢复核验；O2及新增ACK间隙测试。 |
| TARefund.resumeExisting／TA退款owner | Given未付/已付/已确认/已拒绝四组；When恢复；Then分别无提交、等终态、通知、续退款；内部Right不等业务成功。〔H4:165–203,226–262〕 | G=TA/退款决策；H=证据链；O3–O6；T4/T5只读要求。 |
| TARefund.close／TA退款owner | Given挂起terminal回调；When关闭两次；Then待处理调用Unavailable、订阅停止、共享journal/client不被关闭。〔H4:285–292〕 | G=无新增；H=生命周期；T4:452–473明确固定预期。 |
| SIP.create／SIP owner | Given[10,20]完整vector；When创建/重放；Thenintent→create→两append→seal，余额1000.00；改金额/vector冲突。〔H5:124–133〕 | G=创建族；H=可信准入/补前缀；O8。 |
| SIP.revise／SIP owner | Giventick25、r2生效30；When改200.00；Then未来期次用r2；同r2改300.00冲突，他人请求拒绝。〔H5:137–152；A8:12–21〕 | G=区间决定；H=owner与转换；O9。 |
| SIP.pause／SIP owner | GivencurrentTick=-1；When暂停；ThenRequestConflict、零事件；已有tick则记录该tick，不能读系统时间。〔H5:155–163；T6:316–323〕 | G=暂停；H=时标选择；O9及T6固定前置负例。 |
| SIP.resume／SIP owner | Given暂停期10/20已过；When恢复再tick40；Then不复活10/20，只派发30/40；须先分类完整暂停区间。〔H5:166–175〕 | G=恢复/跳期；H=先后次序；O9。 |
| SIP.tick／SIP owner | Given计划时钟分别10/30；Whenoperator tick20；Then全部不变且冲突；tick30可推进两计划，customer调用拒绝。〔H5:178–202；T6:302–315〕 | G=单调时钟；H=预检fanout；O7及独立时钟对[10,30]。 |
| SIP.recoverExisting／SIP owner | Givenintent-only、部分append、已存未dispatch；When恢复；Then补原前缀/原派发；错序成员前缀保持不变并冲突。〔H5:206–213；T8:27–95,128–163〕 | G=原命令；H=精确前缀、触发证据；O8。 |
| SIP.recordTerminal／SIP owner | Given原occurrence及订单；When付款成功或确认回调；Then前者不计、后者一次；伪造occurrence或孤立terminal拒绝。〔H5:305–319；H7:22–100〕 | G=首次计数；H=关联回桥；O10/O11；裸字符串不作真实终态证据。 |
| SIP.close／SIP owner | Given应用已close；When再create/tick；ThenUnavailable；共享directory/journal不由它关闭。〔H5:41–50,321〕 | G=无新增；H=生命周期；新增独立调用及关闭计数预期，不能推定它会取消全部在途Future。 |
| Recovery.reconcileExisting／恢复owner | Given已存refund/payment/occurrence operation；Whenoperator请求；Then只恢复对应原交易；不存在MissingResource、customer拒绝。〔H9:55–82〕 | G=现有恢复协议；H=原记录选择；O5恢复预期；T5直接协调器测试不替代本方法权限测试。 |

读侧七方法各自有场景，不能只验证接口反射存在；下表H均为H10，G只承担已声明投影存储，不推断导航read-model自动生成全部SQL。〔D5:19–25〕

| 方法 | Given / When / Then（独立预期均为P，来源是只读要求） | G / H / O |
|---|---|---|
| accountMe | GivenAlice=123.45、Bob=987.65；WhenAlice查询；Then仅本人MoneyWire("12345","CNY")；错schema拒绝。〔H10:198–207；T9:159–169〕 | G=读取基础设施；H=本人映射/DTO；O12 |
| cashOriginal | GivenBob有same-client-key而Alice没有；WhenAlice查询；Then空view、unknown、空watermarks，不返回Bob来源。〔H10:209–219；T9:134–150〕 | G=读取；H=身份/三状态；O12 |
| order | Given他人订单；WhenAlice查询；ThenNotAuthorized且不取他人payload；本人订单三状态分列。〔H10:175–187,221–224；T9:134–145〕 | G=读取；H=owner/DTO；O12 |
| plans | Given只存在Bob计划；WhenAlice列计划；Then空列表；limit0拒绝，列表不宣称全系统caught-up。〔H10:226–230；T9:151–152,167〕 | G=分页基础；H=选择/metadata；O12 |
| plan | GivenBob原计划；WhenAlice按ID读；ThenNotAuthorized，不暴露水位；本人返回原日程/revision/计数。〔H10:190–195,232–234；T9:140–145〕 | G=读取；H=owner/DTO；O9/O12 |
| occurrences | Given原期次已投影而订单关联缺失；When查询；Then付款/TA/退款为unknown，无补造终态；他人计划拒绝。〔H10:236–253；T9:140–145〕 | G=关联查询；H=缺关联解释；O7/O12；缺关联正例须另写独立预期。 |
| pending | Given同一pending集合；Whencustomer/operator分别查询；Then前者拒绝、后者返回分页且metadata非全局完成证明。〔H10:256–269；T9:153–155〕 | G=索引读取；H=operator边界；O12 |

下层开放行为也须独立覆盖，不把纯函数测试当作完整port验收；这些是同一用例内的方法契约，不再增一层“通用执行器”。

| 行为／H owner | Given / When / Then与独立数据 | G / H / O |
|---|---|---|
| BalanceAfterReserveFunds／现金 | Given可用1000.00；When算预留100.00；Then900.00；缺币种余额拒绝。〔H8:7–11〕 | G=调用及fold；H=纯计算；O13，新增直接方法测试 |
| BalanceAfterCommitIncomingCredits／现金 | Given可用0.00；When入100.00；Then100.00。〔H8:13–14〕 | G=调用及fold；H=纯计算；O13 |
| BalanceAfterReleaseReservedFunds／现金 | Given可用900.00且原预留100.00；When释放；Then1000.00；无预留则仍900.00。〔H8:16–20〕 | G=禁止已commit补偿的guard；H=只加实际预留；O13，后者是源码支持的新增直接方法用例 |
| BankTaBridge.register／TA | Given已付原单；When两次登记；Then同taRequestId；未付拒绝。〔H6:47–61〕 | G=登记/固定host槽；H=核原身份；O3 |
| BankTaBridge.submit／TA | Given已登记原单；When提交同scenario；Then同请求正文/账户/本金；未付无提交。〔H6:38–69〕 | G=effect协议；H=外部调用；O3/O4 |
| BankTaBridge.reconcile()及reconcile(scenario)／TA | Given原请求；When查询；Then应用canonical回执；带scenario重载额外拒绝不符场景；两重载分别建例。〔H6:70–83〕 | G=回执命令；H=查询核实；O3/O4，不用submit代替query测试 |
| BankTaBridge.ingest／TA | Given同receiptId冲突正文；When入站；Then拒绝且保原确认；合法重复零事件。〔H6:120–154；A5:27–29〕 | G=去重/fold；H=权威成员核实；O3 |
| BankTaBridge.requestRefund／TA退款 | Given可信拒绝且无intent；When首次请求；Then一个原本金intent；已有intent即使TA不可用仍取原文。〔H6:84–103〕 | G=退款决定；H=首次核实/既有重入；O5 |
| BankTaEffectExecute／TA | Given原已付request；Whenexecute；Then已知accepted也可技术confirmed，但无份额成功。〔H14:60–75,91–96〕 | G=effect协议；H=已装implementation；O4 |
| BankTaEffectQuery／TA | Given同原request的权威未找到响应；Whenquery；Thenabsent、result为空、提交次数0；普通unknown不可冒充absence。〔H14:15–25,70–75,94–95〕 | G=观察载体；H=证据解释；T4:365–387固定反例 |
| BankTaEffectReconcilePort／TA | Given此前及当前完全相同的权威absence；When正确恢复授权retry；Thentrue但不自行提交；错ID/授权/证据false，提交后旧absence失效。〔H14:77–96〕 | G=恢复协议；H=当前证据再核；T4:365–387，不能称重试债已闭合 |
| BankSipTerminalBridge.record／SIP | Givenpayment succeeded但无TA确认；Whenrecord；Thenpending不计；相关确认两次仍successTotal=1。〔H7:33–100〕 | G=终态fold；H=证据选择；O10 |
| 稳定身份方法／各业务owner | order、operation、plan分别测同principal/key重入及不同principal隔离；StableTaRequestId、StableRefundOperationId分别测同order/payment重入；StableSipOccurrence测plan/revision/slot与原config留存。〔H11:8–24；H12:18–21；H13:15–21〕 | G=载体/显式host调用；H=现有算法；独立字节golden尚缺，列Q6，不能以被测helper算expected。 |

## 5. O：独立预期数据与证据边界

以下从固定测试提取的是**预期**，没有实际运行结果；新增逐方法场景沿用数据语义而不修改固定测试。测试fixture与输出必须分开，不能运行后抄结果。

| O | 预先写定的具体oracle | 只读来源与不能证明的范围 |
|---|---|---|
| O1 | CNY初始1000.00/0.00，付款100.00后900.00/100.00；投资人[reserve,deduct]、募集户[incoming,credit]、订单[subscribe,pay-order]，同tx/resource/amount；募集commit ACK放行前无订单付款事件。 | 〔T1:48–67,133–169,194–203〕；余额/事件序列独立，expectedTxid仍调用Host算法，不能冒称身份字节独立golden。 |
| O2 | 原请求MoneyWire("10000","CNY")对应100.00；来源持久后重放返回空事件；改请求为20000或结算为99.00拒绝。 | 〔T2:24–26,43–65〕；这是聚合/准入要求，不是已经覆盖Cash.submit全部接线。 |
| O3 | 未付款提交次数0；合法付款后TA提交次数1，accepted时份额为空；确认精确为shares="80.0000"、nav="1.2345"；冲突/重复处理后原事件数量不增。 | 〔T4:293–334〕；份额值是模拟fixture，不验证真实估值公式。 |
| O4 | accepted-only场景推进10个TA tick后仍accepted、shares为空、refundOperationId为空、terminalCalls为空、提交次数1。 | 〔T4:391–402〕；推进次数不是基金确认期限。 |
| O5 | 独立退款后1000.00/0.00，原payment仍succeeded；refund intent、成功事件、募集扣款、投资人入款各1；8次并发resume无新增记录。 | 〔T5:25–68〕；只读其测试要求，不能据此声称本轮并发执行通过。 |
| O6 | 退款早拒绝/已补偿时900.00/100.00、退款成功事件0、募集扣款事件0、terminalCalls为空；unknown尚未确定时不标到账。 | 〔T5:72–94,175–215〕；账务与业务终态分开断言。 |
| O7 | [10,20]各100.00、tick20：两个occurrence、余额800.00、successTotal=0、failureTotal=0；tick19冲突、重放tick20不再扣。 | 〔T6:221–242〕；SIP-only fixture无TA worker，不证明外部终态。〔T6:34–36,144–145〕 |
| O8 | [10,20]日程恢复为slots={0→10,1→20}、逆索引={10→0,20→1}、scheduleCount=2、sealed=true、tick=-1、occurrences空；错序{0→20}保持原样且拒绝。 | 〔T8:27–55,83–95〕；仅同JVM恢复要求，不能作跨JVM证据。〔T8:15–18〕 |
| O9 | [10,20,30,40]，tick0暂停、tick25，r2从30起200.00；恢复tick40后仅30/40两期，startCount=4、余额600.00；旧backlog另用100.00/200.00区间例核验。 | 〔T6:244–260；T7:95–112〕；没有推断真实日历。 |
| O10 | 单期相关确认后firstTerminals={该期→succeeded}、successTotal=1、failureTotal=0、余额900.00；重复/恢复计数仍1，伪造operation或200.00配置拒绝。 | 〔T6:262–300〕；该例经内部命令造TA事实，不替代外部回执入站鉴权。 |
| O11 | 初始余额0.00，三期真实付款失败后failureTotal=3、successTotal=0、paused=false；第四期40仍可触发。 | 〔T6:324–339〕；三败不自动暂停，失败后是否人工处置另列Q。 |
| O12 | 本人123.45→minorUnits="12345"；他人order/plan拒绝；同客户key隔离；未认证/伪造角色不取连接；列表unknown不等失败或业务不存在。 | 〔T9:113–169；H10:163–173〕；controller替身测试不替代真实读侧或HTTP验收。 |
| O13 | 预留前1000.00，取消前置fence后仍1000.00且late Reserve空事件；正常扣款后900.00/100.00；原付款commit重放无新记录。 | 〔T10:37–66；H8:10–20〕；总可用额在预留期间不必恒等初始总额，不能拿最终守恒式误判中间态。 |

P：对每个场景分别留“原始输入、预写expected、实际event/state/reply、运行范围”四份证据；数据oracle不读取被测实现计算expected。
P：正常证据从真实命令/持久化实现产生；故障替身只截断边界或构造明确反例，不制造成功资金状态、手造成功收据或通用假业务引擎。
P：除正例外逐方法记录拒绝码、零新增事件/零第二资金效果、保留原身份、未发生的外部调用；缺独立预期标缺口，不以文件数或测试数抵账。

## 6. P：可读实现与生成边界的交付约束

1. 每个用例只保留一个容易找到的应用入口；方法体应读出“请求→已留存证据→业务决定→事件→状态→回复”，命名解释为什么允许、拒绝或幂等。
2. 保持A1/A2/A3/A5/A6/A7/A8中已完整声明的guard、事件绑定与fold可确定性生成；不为了显得有业务，把这些规则复制到第二套手写decide。
3. H3的可信配置检查、H6的权威回执核验、H5的精确前缀、H7的相关终态选择都不是无意义胶水；先给这些行为独立BDD，不能删除后宣称“领域已全生成”。〔H3:43–65；H6:120–154；H5:89–105；H7:22–100〕
4. 手写关系声明明确把BankApplicationPorts标为supports内部facade，而不是新增source-defined ports；Cash/SIP/TA应用也标supports。不要将相同调用再包装成三层无决策的port。〔D6:145–149,161–167,353–375〕
5. 允许为有副作用边界、独立业务责任或可替换外部实现保留port；不增加“通用执行器→策略wrapper→领域wrapper→原应用”的转发链。
6. 状态只在事件应用中演进，Saga负责事务、Monarch负责阶段编排；不复制运行库协调器、另造Actor现金缓存或把Promise队列当耐久业务状态。〔D2:26–28；D5:29–34；H4:26–29；H5:22–24〕
7. Agent编写的实现和独立测试仍属手写维护；公共编译/生成能力归工具链owner，业务输入/模拟/预期归银行；不接管其他业务表达owner或创建公共schema。〔D3:78–85〕
8. 将一个确定性行为迁入生成器须另有完整输入表达、同语义独立oracle和对应制品验证；未表达的决定不能由模板猜测。本轮无此迁移授权。

## 7. Q：本角色负责推进的未决决定

| 未决问题 | 当前证据与不允许的推断 | 本角色承担的下一份具体答案／所需决定 |
|---|---|---|
| Q1 accepted究竟向客户承诺到哪一步，Unavailable后如何解释？ | 源码已先存source再start、核RunStarted后accepted，异常统一Unavailable。〔H2:22–35,72–87〕 | 研发负责人牵头给“未准入／原文已存／已启动／付款终态”回复表供主集成裁定；不新增状态字段或擅改HTTP合同。 |
| Q2 份额、NAV和本金如何勾稽？ | 只核正文本和原本金关联，fixture直接提供份额；零费只在模拟配置合同。〔H6:132–154；M1:113–117；M2:24〕 | 架构师牵头区分“仅演示回执保真”与“演示计价”；请业务方案owner选定范围，验收负责人随后手写数值预期；不改现有固定oracle来消差。 |
| Q3 暂时故障何时自动续接、何时提示人工？ | 现有polling和absence授权不等完整retry/backoff/deadline闭合。〔H4:55–76,205–223；H14:77–88；D1:127–129〕 | 架构师给暂时不可得/确定未执行/未知/业务拒绝/已commit证据分支表；预算、期限和人工触发阈值须明确决定，不拿32次技术交互预算替代。〔H9:25–32〕 |
| Q4 配置版本改变时旧请求还能怎样恢复？ | validateCash/validateSip要求authorityVersion等于当前配置版本。〔H3:43–65〕 | 研发负责人提交版本固定或显式迁移两种方案及拒绝反馈；本轮不批准任一方案、不改旧source或恢复证据。 |
| Q5 日程用slot能否满足演示可读性？ | 当前严格有限vector及显式tick；首次tick前暂停冲突。〔H3:63–65；T6:316–323〕 | 研发负责人提供slot10/20/30的操作说明候选；如需日历，先由业务owner选时区/节假日/受理规则，不推定自然日或交易日。 |
| Q6 身份算法如何获得独立字节oracle？ | O1的expectedTxid调用Host；源码含三套明确身份构造，不能把同helper自证当独立正确性。〔T1:71–72；H11:8–24；H12:10–21；H13:10–21〕 | 验收负责人独立推导小输入、中文、分隔歧义的字面golden，分别覆盖每个方法；不调用生产helper生成expected，不修改当前固定测试。 |
| Q7 哪些方法还缺直接行为测试？ | 来源聚合测试≠Cash应用；读侧查询≠getOriginal；SIP内部TA命令≠外部ingest；同JVM恢复≠跨JVM。〔T2:43–65；H2:38–53；T6:271–284；T8:15–18〕 | 验收负责人按第4节逐方法提交缺口/独立预期清单；后续授权窗口才运行，不把本轮只读定位记成PASS。 |
| Q8 退款未完成或多次定投失败给谁处理？ | 退款compensated不等本金返回，三败不暂停；没有从这些事实推出新人工处置期限。〔T5:175–215；T6:324–339〕 | 架构师联合主集成明确模拟运营动作与客户提示，只允许恢复已有operation；任何新豁免、自动暂停、替换目的地政策先裁定。 |

## 8. P：有界实施包与停止条件

- 包一：UC-C的可读入口、原请求/资金决定及每个Cash方法独立BDD；完成不等TA成功。
- 包二：UC-T/UC-R的逐方法回执、权威查询、独立退款及失败恢复；技术effect完成不替代业务终态。
- 包三：UC-S的完整vector、未来revision、暂停分类、原期次派发和首次终态；保留有限定投，不新增日历或三败暂停。
- 包四：七个查询方法的独立权限/水位/缺关联解释及逐层证据，不以页面状态替代余额与原事件。
- 每包先由主集成决定新增业务内容和精确写集合，再实施；公共生成器改动单独交工具owner，银行不另造通用协议。
- 所有包都要求G/H/O可追溯且负例成立；未决业务问题未获明确答案时，仅交付已支持边界，不能发明默认成功。
- 本轮停止于本文：目标写入前已确认不存在；不覆盖已有文档，不改作者树、绑定、生产/生成代码、固定测试、oracle或任何运行证据。
