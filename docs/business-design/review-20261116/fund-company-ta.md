# 基金公司/TA 有界用例候选设计

## 0. 身份、范围与使用方式

- 日期：2026-11-16；视角：**虚拟基金公司/TA对接负责人＋基金交易产品专家**。
- 本文是模拟业务设计候选，不是会议纪要、真实机构协议、专家意见、监管批准或实施授权；没有真实基金公司、专家或监管人员参与。
- 【源事实】表示下列当前文件实际声明或实现的内容，不表示本轮执行通过；【既有模拟假设】只约束MockTA；【角色提案】待逐项裁定；【未决】不能由技术实现自行填空。
- 当前唯一作者根为 `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth`；本文不被编译、不另建规则副本、不增加公共schema。[S00:3–13；S01:5–22]
- 主导航明确只是描述性用例，不是执行DSL、授权policy或审批记录；本设计沿实际切片和手写边界细化步骤。[S03:3–8,348–651]
- 仅提出“已付款订单→TA注册/提交/查询→受理或终态→必要时交给独立退款”的有限链路，保留有限定投的关联接口，不扩成持仓估值、真实清算或生产金融认证。[S01:24–30；S02:78–85]
- 本轮只读源码并保存此设计；未运行服务、编译、测试、生成或业务交易，未读取旧运行journal，未修改作者树、绑定、实现、固定测试和oracle。

## 1. 可复核来源坐标

以下每个 `S编号:行号` 都是该行**完整绝对路径:行号＋完整source SHA-256**的缩写；后文的既有规则必须连同此表解释。
SHA是本轮所读文件字节摘要，不是批准标识；仓库HEAD为 `f8ac7ca882335a7c84cff7cbcb5100b6091b864a`，不以HEAD代替工作树文件摘要。

| 编号 | 源文件与主要行区间 | source SHA-256 |
|---|---|---|
| S00 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/AGENTS.md:3–13,122–132` | `d06ea3445bd1f2e3230c104fe140fb7379d31dd9af018fc03a069fda7731b26c` |
| S01 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/TRUTH.md:5–30` | `22ff12d956f30fb46abc5d919255b58f1f1cf3c9be338b4d045e466a1b522520` |
| S02 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/docs/FUND-PURCHASE-BUSINESS-DELIVERY-20261115.md:4–12,49–59,65–85` | `b02e381b853748507e2ea8c4e987fb6913123b57887a2818facb836e8e566ec4` |
| S03 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/use-cases.yaml:3–8,348–651` | `531663b9e938256b465d3b302a4d5e6798aacb689cd198a795668764aadb3b5e` |
| S04 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/record-cash-request-source.slice.yaml:13–20,35–47` | `55119a58a3440d079af5cc647202fef6e7b3951835a6097950dc34c07fdd3252` |
| S05 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/structures/outgoing-funds.structure.yaml:15–19,47–55,86–93,127–137` | `825c0141d95f6a02418424aa8e0d43dd30a5bbae607f6deb5a02efde3effa720` |
| S06 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/register-fund-ta-submission.slice.yaml:13–16,30–44` | `b87683b90216e1c3b45176f974513a9d481c442a325ae3d979e237410f932261` |
| S07 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/record-fund-ta-accepted.slice.yaml:19–28,55–70` | `2b83eb58116406a0e0c3a680a195cbb5722a35936eacb7292acfcea508cf82cf` |
| S08 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/record-fund-ta-confirmed.slice.yaml:20–33,58–75` | `5f06801a987491448c7a79c92c314c00b3f71c90eac2425a679ce23276280793` |
| S09 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/record-fund-ta-rejected.slice.yaml:20–33,58–75` | `a0ae573010d324fe6920eb7f5884c67015c9eaa75f95e9be79e69cea490c97fe` |
| S10 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/record-fund-ta-unknown.slice.yaml:19–28,55–70` | `389ad3be310c9210f71d83c936aff00314b78e55ec0c96c2501b99b75458eeb2` |
| S11 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/request-fund-purchase-refund.slice.yaml:13–17,31–51` | `6977766c5484f0c003451f5df93102acd3efd6d3102d5d7c14960f66ed6fdfb8` |
| S12 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/simulator/contract.mjs:102–182` | `19d6fa131f05ca23ea01e916c6149f26cc3d78124f0bd555c094d9d4eeee456f` |
| S13 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/simulator/mock-ta-core.mjs:13–50,80–99,144–189` | `a31b1fe4167a61390de36ff1a45e67da0695eaa40b42713c681155e13d71acda` |
| S14 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/BankTaBridge.scala:24–162` | `bf8efecf3f15aca841a6a6ef870de8b1bf7c12269a95c1ce66f2a7e9de1ac7de` |
| S15 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/ta/BankTaRefundApplication.scala:121–163,165–263` | `579a2d43451f9c7be63ffd6dbcc156813803664e903ef1b0c03c913648b3719f` |
| S16 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/StableOrderIdentity.scala:9–21` | `ec667552d797dacc85eb8890747b8ae9f08ba9ef3eb0738e815318ce04b5018c` |
| S17 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/BankTaEffectBindings.scala:13–48,60–96` | `8e5fe053f57524b8ceda63248d5fafa708eb7ca00e010293f1173a5940959b2c` |
| S18 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/pipelines/bank-ta-submission-v1.pipeline.yaml:9–59,91–102` | `46bad8ea8cde64686659b2e436a4714e5eb21814a1782940dd74ed92a1e03a20` |
| S19 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/trigger-sip-installment.slice.yaml:15–27,48–61` | `7499c577498e085c8ff8246c5d633ad1c9106df458e219553f5eb9f3000c5419` |
| S20 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/revise-sip-plan.slice.yaml:12–21,42–56` | `7e1714c020b34d9b9adb8daf93ed91aad9cf953606c6c47c2ad8a8de09d884d8` |
| S21 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/record-sip-installment-succeeded.slice.yaml:15–24,61–65` | `3ad7d3e3feed55f65859a03accc077cf49514f95537dfcb3e015182e5fd621e4` |
| S22 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/record-sip-installment-failed.slice.yaml:15–24,61–65` | `373a09ee4da5648cfaf8b6a84fdb8ba9a3eee77a89c396eff5133830ff5ecc30` |
| S23 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/BankSipTerminalBridge.scala:22–101` | `a1cdd34f40425aaa93cf95f86ad2fbaade5893e9d3cbae5263de188576865a6d` |

## 2. 本设计必须承接的事实与模拟边界

1. 【源事实 F1】`CASH_SOURCE_CONFLICT/ONCE/BEFORE_SETTLEMENT`保留原现金来源：同源可空成功，异正文拒绝，首次记录须在settlement前；切片的`CASH_SOURCE_BODY`只显式比较其列出的字段，不能把它夸成单独完成全部金额验证。[S04:13–20,45–47]
2. 【源事实 F2】`TA_SUBMIT_RESOURCE/TA_PAID/TA_SUBMIT_ONCE`要求本订单、本selectedPaymentTxId已记`succeeded`，只注册一次；应用另核原付款请求、付款确认、付款成功证据及受信账户/基金配置，不能只看页面状态。[S06:14–16；S15:121–149]
3. 【源事实 F3】TA请求ID由原orderId与paymentTxId按长度前缀UTF-8编码得到，使用`bank-ta-v1/`前缀；独立退款用不同的`bank-refund-v1/`前缀。身份确定性在现役手写实现中，不因此自动归属模板。[S16:9–21]
4. 【源事实 F4】可信bridge核订单、付款、TA请求、两个账户、fundCode和与原本金完全相等的Money；份额与NAV为正十进制原文本。切片本身不含这一完整外部报文验证，必须保留bridge责任。[S14:132–154；S08:20–30]
5. 【源事实 F5】`ingest`不仅decode，还按原requestId查询，要求回执对象属于权威`canonicalReceipts`，再发领域命令；这是本地MockTA合同下的“权威”，不等同真实机构签名认证。[S14:105–129]
6. 【源事实 F6】`TA_RECEIPT_CONFLICT`先核同receiptId的正文及outcome，`TA_RECEIPT_ONCE`随后才空成功；已终态的新终态回执触发`TA_TERMINAL_CONFLICT`。同内容但换一个receiptId不是已认可的重复终态。[S07:25–28；S08:26–30；S09:26–30；S10:25–28]
7. 【源事实 F7】合法的迟到accepted/unknown在终态后空成功、不覆盖终态；但关联或同ID正文冲突仍先拒绝。它们不会因“迟到”跳过前置核验，也不会新增该进展事件。[S07:20–28；S10:20–28]
8. 【源事实 F8】真正成功事件是`FundTASharesConfirmed`；技术effect的`confirmed`仅为已知提交观察，accepted也可满足其known判断，不能替代投资成功。[S08:32–33,70–75；S17:70–75；S18:9–11]
9. 【源事实 F9】退款须原付款成功且TA状态rejected，唯一intent的金额及两账户来自订单状态；bridge首次创建intent前还查询唯一权威拒绝。已有intent则可复用，不要求外部TA再次可用。[S11:14–17,41–51；S14:84–103]
10. 【源事实 F10】`LEDGER_NOT_COMMITTED`禁止释放已提交出款；同交易异金额被账务match规则拒绝。TA拒绝不能用“补偿原付款”代替独立反向退款。[S05:18–19,86–93；S01:26–28]
11. 【源事实 F11】有限定投保留已触发occurrence/config；`SIP_OCCURRENCE_REPLAY_CONFLICT/ONCE`区分异配置与重入，修订生效点须严格晚于currentTick和latestEffectiveSlot；新修订不能改写旧TA请求。[S19:18–27,58–61；S20:14–21,52–56；S23:26–28]
12. 【源事实 F12】定投成功须相关TA确认；TA拒绝分支须退款完成才计失败；首次终态只计一次。付款成功、accepted、unknown、退款处理中不是定投最终成功/失败；没有三败自动暂停政策。[S21:18–24,61–65；S22:18–24,61–65；S23:33–101；S00:124–129]
13. 【既有模拟假设 M1】Mock配置只接受CNY、`feesMinorUnits="0"`、`refundMode="full-principal"`；请求本金是正规范整数文本，账户不同，scenario须已配置。不是现实基金统一收费/退款规则。[S12:113–145,166–182]
14. 【既有模拟假设 M2】confirmed fixture只要求shares/nav为正规范十进制文本；模拟器直接复制fixture，没有按申购本金推算份额，也未核`本金=份额×NAV＋费用`。[S12:102–110,131–145；S13:18–25]
15. 【既有模拟假设 M3】提交先产生accepted；unknown场景再产生unknown，accepted/unknown-only没有未来终态时间；confirmed/rejected按显式tick推进。查询本身不推进时钟，不把tick解释为交易日。[S12:129–136；S13:29–50,156–189]
16. 【既有模拟假设 M4】同requestId同完整正文返回原查询，异正文抛`REQUEST_CONFLICT`；不存在返回`REQUEST_NOT_FOUND`观察和空回执。冲突重复投递不增第二个canonical终态；模拟器不执行资金扣退。[S13:80–99,144–173]

## 3. 行为与交付所有权约定

以下UC编号只用于本文定位；不是新真源ID。G/H/O是交付责任，不是新的架构schema。

| 行为组 | G：可按现有显式输入确定性生成的内容 | H：现役/拟补的手写责任 | O：独立预期数据，不从被测输出反抄 |
|---|---|---|---|
| A 原单注册 | 注册命令、guard、事件及fold [S06] | `paid/register`证据核对、StableOrderIdentity [S14–S16] | 原订单/付款事实、固定身份向量、0/1注册事件 |
| B 提交与核实 | TA pipeline输入、观察/恢复协议 [S18] | `submit/reconcile`、effect绑定、MockTA [S13–S17] | 固定请求正文、查询回执集合、原ID不变、无第二提交 |
| C 回执入单 | accepted/confirmed/rejected/unknown各切片 [S07–S10] | `decode/ingest`权威查询、错误路由 [S14] | 正反报文、原始文本、确切事件数和拒绝点 |
| D 退款交接 | 唯一退款intent及原参数绑定 [S11] | `requestRefund/finish`继续原退款身份 [S14–S15] | 原本金、原两账户、付款事实保留、退款前后分层结果 |
| E 定投回桥 | occurrence/revision/首终态guard及fold [S19–S22] | 原订单证据关联与终态回桥 [S23] | 两期不同配置、迟到原回执、独立计数向量 |

【角色提案】新增客户解释、冲突处置和人工核实步骤先作为H侧候选；未经明确决策，不让生成器从散文推断新政策。
Agent写的实现和独立用例仍由H/O各自维护；可生成的既有规则不另抄一份手写决策器。[S02:19–24,80–83]

## 4. 五个有界用例提案

### UC-TA-1：为已付款原单登记唯一TA申请（责任组A）

- 【角色提案】目标：银行能说明“哪笔钱对应哪次申购申请”；触发者为受信银行应用，受益人为该订单客户。
- 前置承接F1/F2；成功后只获得已登记申请，不获得“TA已受理”或“投资成功”。
- 步骤1｜银行付款责任方提供原订单、付款交易、本金、基金、账户及相关付款成功证据；TA对接应用核证据一致，而非按页面绿色标签决定。[S15:121–142]
- 步骤2｜受信应用选择demo scenario；客户不提供forced result；对接适配按原订单构造TA申请，不接受新目标账户或新本金。[S17:28–40；S14:38–45]
- 步骤3｜订单按`TA_PAID`等决定允许登记；稳定ID计算后产生`FundTASubmissionRegistered`，订单成为submitted；此时尚无外部受理承诺。[S06:13–16,30–44]
- 步骤4｜【角色提案】向观察方解释“付款已完成，申购申请已登记，等待TA结果”；显示付款与TA两栏而非一个成功勾选。
- 替代路径：原登记重入返回原身份、不增登记；错误订单/未付款拒绝，不能通过换paymentTxId重试。[S06:14–16；S14:47–61]
- 失败路径：【角色提案】原付款证据不完整时停止TA发送并列出缺失证据类别；不修补付款事实。输出是待核实，不是TA拒绝。
- 独立预期：A组案例K1/K2；既有来源事实与本提案客户文案分别签收。

### UC-TA-2：提交原申请，按原身份核实未知（责任组B）

- 【角色提案】目标：提交丢应答后不重复申购；参与者为银行TA对接应用和本地MockTA，外部替换适配另议。
- 前置：已存在唯一注册；提交正文包含requestId/orderId/paymentTxId、投资人户、募集户、fundCode、amount及受信scenario。[S14:38–45,63–83]
- 步骤1｜对接应用调用submit；MockTA按完整正文判断首次、同文重入或异文冲突，返回原请求和canonical回执。[S13:144–173]
- 步骤2｜银行消费受理/终态回执走UC-TA-3；即使effect观察为confirmed，也只关闭“已知提交观察”，不承诺份额。[S17:70–75；S18:9–11]
- 步骤3｜应答不明时，银行沿原requestId查询；query返回的原正文仍须与已付款订单全量关联，不能拿另一申请的成功回复结案。[S14:75–83,105–118]
- 步骤4｜【角色提案】查询失败交给运营待核实视图，保留原申请；不要自动生成拒绝、退款、第二笔申请或成功份额。
- 特殊替代：严格形状的`REQUEST_NOT_FOUND`可成为absence证据；现役恢复另要求先前与当前同一absence及受信授权，再继续原身份。普通unknown/超时不等absence。[S17:15–25,77–88；S15:205–223]
- 失败路径：同ID异正文作为关联冲突，不换ID“绕过”；原scenario发生漂移则拒绝核实，不用新scenario重解释旧申请。[S13:147–150；S14:79–81]
- 【未决 Q1】重试次数、间隔、业务期限、人工进入/退出条件仍待决定；不能把某个轮询间隔或pipeline机制当基金公司的办理承诺。[S00:127–129]
- 独立预期：B组K3–K5；本轮没有执行重启/恢复窗口。

### UC-TA-3：受理、份额确认与冲突回执入单（责任组C）

- 【角色提案】目标：客户知道“申请受理”与“已确认份额”的差别；银行负责关联与入单，模拟TA负责给出其canonical结果。
- 步骤1｜银行收到报文，先核固定字段形状、精确金额、账户/基金/付款/request身份、业务tick和份额文本；字段格式正确只是准入，不是业务确认。[S14:132–154]
- 步骤2｜银行向原TA查询并验证回执对象存在于canonical集合；再调用对应领域命令。回调自身声称confirmed不够。[S14:120–129]
- 步骤3｜订单按F6/F7判断新进展、同文重复、迟到进展或终态冲突；保持原receiptId、规范处理后的receiptBody和shares/nav文本。[S07:19–28,55–70；S08:20–30,58–75]
- 步骤4｜accepted显示等待；confirmed产生`FundTASharesConfirmed`并保留TA给出的份额与NAV；rejected转UC-TA-4；unknown保留未决。[S07–S10；S15:226–261]
- 步骤5｜【角色提案】对confirmed只承诺“该订单已获模拟TA份额确认”，不延伸成可赎回持仓、实时市值或按某交易日估值。
- 替代路径：首次收到相关confirmed可直接终态，切片没有必须先收到accepted的guard；不要把模拟器通常先accepted误写成银行硬前置。[S08:20–30；S13:29–36]
- 失败路径：同ID异正文先拒绝；另ID的新终态即使内容相似也拒绝；合法迟到accepted/unknown不覆盖终态。拒绝点可能在bridge权威成员核验，也可能在聚合guard，不能混写一种错误码。[S14:125–129；S07:26–28；S08:27–29]
- 【角色提案】发生冲突时暂不接纳新结果，保留原终态；运营需并列原证据与冲突证据请求核实。不得把“首终态不可覆写”解释成现实TA永远不会更正。
- 【未决 Q2/Q3】现实份额计算、更正/撤销回执协议均未给出；本文不新增自动净额退款、调仓、终态覆盖或计价公式。
- 独立预期：C组K6–K10，尤其分别验证“聚合空成功”与“外部报文被拒绝”。

### UC-TA-4：可信拒绝后交接独立全本金退款（责任组D）

- 【角色提案】目标：明确投资失败与本金退回不是同一时点；TA对接负责拒绝证据，银行退款业务负责资金返回。
- 前置：原付款成功、相关TA拒绝已入单；TA拒绝原因非空，不能由网络错误替代。[S09:21–30；S11:14–17]
- 步骤1｜首次退款意图由bridge查询原申请，要求唯一canonical rejected回执并重新摄入；若TA此刻不可用，保持拒绝与待退款，不伪造已退款。[S14:84–100]
- 步骤2｜订单生成唯一`FundPurchaseRefundRequested`，本金及两账户来自原状态；没有客户选择退款目的地或金额的参数。[S11:9–17,31–51]
- 步骤3｜银行应用恢复独立退款parent/transaction；明确其transaction不同于原paymentTxId，不调用原付款的补偿分支。[S15:233–252；S05:86–93]
- 步骤4｜【角色提案】客户分别看到“付款成功／TA拒绝／退款处理中”；只有相关退款成功证据到达，才显示本金已退。原付款成功仍保留。[S01:26–27；S15:253–258]
- 替代路径：既有退款intent在TA不可用时仍可恢复；不因查询失败铸造第二个退款身份。[S14:87–103]
- 失败路径：unknown/accepted不满足退款guard；退款尚未完成时不把定投该期计为“TA拒绝且已退”的失败终态。[S11:16；S23:63–94]
- 【既有模拟假设】全本金、零费用来自M1；MockTA只给结果，不执行退款。真实部分受理、费用扣收或尾差退款不在这个合同内。[S12:114–117；S13:98–99]
- 独立预期：D组K11/K12；银行资金总账的独立验收另由对应owner补足，不能以TA模拟器状态代替到账证据。

### UC-TA-5：定投修订后的旧申请迟到结果（责任组E）

- 【角色提案】目标：未来定投改配置不篡改在途申请；对接负责人保留原单关联，定投责任方决定期次计数。
- 步骤1｜每次已触发occurrence保留该期revision/config，TA仍沿该期付款原单办理；未来revision仅进入其生效区间。[S19:20–27,54–61；S20:21,52–56]
- 步骤2｜旧申请迟到确认仍核对旧occurrence的本金/基金/账户，而不是计划最新配置；相关确认交给首终态计数。[S23:26–44,83–101]
- 步骤3｜TA拒绝但退款未完只记录进展；完成退款后相关失败计一次；重复通知不再制造终态或多计一次。[S23:63–101；S21:21–24；S22:21–24]
- 失败路径：将新版金额回执关联旧期必须拒绝；不得以“统一最新配置”修复身份冲突；三次失败也不自动暂停。[S23:26–28；S00:127–129]
- 独立预期：E组K13/K14；不重新设计有限日程，不推定交易日、节假日顺延或自动暂停阈值。

## 5. 独立候选场景与具体oracle

【角色提案】以下是尚未执行的Given/When/Then设计，不是新增固定测试或金融oracle文件。
O1：桥/聚合夹具订单`O`、付款`P`、投资人户`I`、募集户`C`、基金`F`、MoneyWire本金`{minorUnits:"10000",currency:"CNY"}`；可信配置及原付款事实由Given显式提供，非真实客户/基金。
O2：独立身份向量按字节`00 00 00 01 4F 00 00 00 01 50`手工规定，TA身份应为`bank-ta-v1/AAAAAU8AAAABUA`，退款operation为`bank-refund-v1/AAAAAU8AAAABUA`。[S16:10–21]
O3：候选模拟scenario `demo-confirm`在tick=10提交、delayTicks=2、fixture=`shares:"80.0000",nav:"1.2500"`；这是测试设计选值，不声称当前部署已有该scenario，不据此建立份额计算政策。[S12:102–145]
O4：聚合guard隔离案例可用receiptId=`RA/RC/RU`与固定正文`B-A/B-C/B-U`；这些不是可直接投递的MockTA wire回执。bridge案例须用字段齐全的独立报文及query替身，真实Mock核心则单独验证canonical/投递关系。
O5：所有预期事件数、字面金额、原文与状态向量先写定；不得调用被测身份工厂、份额算法或Mock回执构造器生成“独立预期”。各项G/H/O责任沿§3，不把测试代码归入模板覆盖区。

| 案例／责任 | Given | When | Then／独立具体oracle与来源 |
|---|---|---|---|
| K1／A：首次与重入 | O1已付款，TA未注册 | register两次 | 首次注册事件1个、第二次新增0个；两次均为O2的同一TA ID；无份额确认事件。[S06:14–16,37–44；S14:47–61；S16:18–19] |
| K2／A：付款条件 | 订单O，selected付款P，但finalResults无`succeeded` | RegisterFundTASubmission(O,P) | `TA_PAID`拒绝；新增注册0、提交0；技术付款应答不能代替Given事实。[S06:14–16] |
| K3／B：同文与异文 | Mock已保留O1请求 | 原文重发；再仅将minorUnits改`10001`重发 | 原文返回同一request/canonical集合；异文`REQUEST_CONFLICT`，原本金仍`10000`，不增第二申请。[S13:144–153] |
| K4／B：查询不造终态 | O3已在tick10提交 | query两次；随后受信时钟推进至12 | query阶段仍accepted、canonical数1；推进后canonical数2且仅1个confirmed，原文80.0000/1.2500；不是“经过两天”。[S13:29–50,156–189] |
| K5／B：不存在与未知 | 一组无request；另一组已有unknown场景原请求 | query各自原ID | 无request组：空canonical、REQUEST_NOT_FOUND；unknown组：accepted＋unknown两回执、pending=true；均无退款和份额确认，不能把二者都当可重提证据。[S13:29–36,156–173；S17:15–25] |
| K6／C：受理不是成功 | O1已注册，权威accepted报文完整 | ingest accepted；同时effect报告known | taStatus=accepted，新增FundTAAccepted=1，FundTASharesConfirmed=0，refund intent=0；effect可confirmed但投资未成功。[S07:64–70；S17:70–75；S11:16] |
| K7／C：精确本金关联 | 原本金10000，权威查询原单保持O1 | 将回执金额改10001；另例换账户C为X | bridge在decode拒绝；各例新增订单事件0，本金10000不被改写；不能只比较币种。[S14:139–145] |
| K8／C：份额原文 | 权威confirmed含80.0000/1.2500，原单关联完整 | ingest；重复同receiptId/正文/outcome | 确认事件合计1、第二次新增0；保存文本逐字符相同，不变成80/1.25，不重算净值。[S14:31–34,147–154；S08:27–30,70–75] |
| K9／C：两层冲突 | 已存RC/B-C的confirmed | ①同RC改正文；②新receiptId带confirmed；③非canonical伪造投递 | 聚合隔离①TA_RECEIPT_CONFLICT，②TA_TERMINAL_CONFLICT；bridge③权威成员核验拒绝；三者原终态/份额不变、新终态0。[S08:27–29；S14:125–129] |
| K10／C：迟到进展 | 已confirmed；关联正确的新accepted/unknown | 分别发对应聚合命令；另例同RC异正文 | 前两例成功但新增事件0，taStatus仍confirmed；冲突例先拒绝而非迟到吞掉。外部报文是否canonical须另过bridge。[S07:26–28；S10:26–28；S14:120–129] |
| K11／D：拒绝与退款意图 | O1已付款，TA拒绝原因为`DEMO_REJECT`且查询有唯一canonical拒绝 | requestRefund两次 | 退款intent合计1；金额10000、账户I/C、operation=O2退款ID；原付款仍succeeded，不等本金已到账。[S09:30；S11:14–17,41–51；S14:84–103] |
| K12／D：非拒绝及恢复 | 子例一taStatus=unknown；子例二已有合法退款intent、TA不可用 | 请求退款／恢复原退款 | 一：REFUND_TA_REJECTED、新intent0；二：复用原intent/金额/账户，不能新增operation；资金到账不得从此调用成功推断。[S11:16；S14:87–103；S15:253–258] |
| K13／E：旧期迟到 | 旧期已固定本金10000；新revision未来期本金20000 | 旧订单TA确认10000；反例仅将旧回执改20000 | 正例沿旧occurrence确认，successTotal从0到1；重复仍1；反例关联拒绝、旧期配置不变。[S19:20–27；S20:21；S23:26–44,96–101；S21:61–65] |
| K14／E：退款前不计失败 | 原期TA已拒绝、首终态空，successTotal=0/failureTotal=0 | 先通知退款处理中，再通知相关退款成功，再重复 | 计数依次(0,0)→(0,1)→(0,1)，不是TA拒绝即(0,1)；不触发自动暂停。[S23:63–101；S22:61–65；S00:127–129] |

【既有模拟假设的负向刻画】将O3的shares改为`79.0000`而NAV仍`1.2500`，仅就fixture校验及makeReceipt而言仍能接受/复制；这不是合理计价已证明，而是M2暴露的业务缺口。是否新增金额一致性政策必须先解决Q2，不能为了让场景“看起来真实”静默补公式。[S12:102–110；S13:18–25]
【角色提案】将K1–K14分别落实到具名H方法及G决策边界后再申请执行；端到端资金oracle须另核实际账务余额/事件，不以本表里“intent=1”冒充退款完成。

## 6. 我方持有的未决项与建议取舍

以下均未批准；我方负责提出所需业务输入及反例，主集成者组织裁定，不以“交给技术”关闭问题。

| 未决项 | 我方责任／需要的业务决定 | 角色建议及不决时的边界 |
|---|---|---|
| Q1 未知处置 | TA对接负责人提供“无受理证据、已受理待终态、TA暂不可用”的外部保证差异；与银行运营确定重试预算、期限和人工交接/恢复条件 | 不给任意秒数或次数；只保留原身份核实。现有absence规则是模拟合同证据，不证明真实TA查无即未执行。[S17:15–25,77–88；S00:127–129] |
| Q2 计价与金额口径 | 产品专家需明确真实申购金额/确认金额/费用/净额、份额精度、舍入与尾差归属，何处取NAV，是否允许部分受理 | 当前保留原本金精确关联＋fixture原文，不把shares×NAV校验伪装为现规则；真实规则未知时明确“不提供估值与费用计算”。[S14:142–154；S12:102–117；S02:67–72] |
| Q3 迟到更正与冲突 | TA对接负责人需取得结果版本、撤销/更正关联、权威来源及先后关系；与银行产品决定原终态/退款已发后如何处理 | 当前不自动覆盖终态、不新增补扣补退；建议冲突单独待核实。不能从TA_TERMINAL_CONFLICT推导现实“先到必正确”。[S08:27–29；S09:27–29] |
| Q4 日期口径 | 产品专家列明申请时间、受理时间、交易日期、确认日期各自提供方与含义；需否引入真实日历另选 | demo只显示显式businessTick，不宣布T+N、截止时点、节假日顺延或某日NAV。[S12:119,129–136；S13:29–50] |
| Q5 报文等同性 | TA对接负责人决定真实回执身份、原始报文留存及字段顺序/格式差异的处理；目前bridge先按JsonNode核权威，再序列化receiptBody | 不声称现有receiptBody是网络原始字节；保留shares/nav文本。传输取证与业务规范化不同，不靠一个hash取代协议。[S14:128,153–154；S07:26–27] |
| Q6 客户承诺与冲突可见性 | TA对接与银行产品共同确定accepted/unknown/查询不可用/拒绝退款中/确认的文案及运营可见字段；确认谁可启动核实 | 建议分层状态，不新增“所有角色可看全部回执”的权限；叙事readEvidence本来就不授予权限。[S03:8,529–545] |
| Q7 模拟到真实的门槛 | TA对接负责人列出真实身份认证、回执真实性、查询一致性、幂等范围及更正协议的输入清单；不得假称已有机构确认 | 继续允许MockTA完成有界demo；真实接入另立合同，不把模拟canonical查询当生产对接认证。[S02:12,83–85；S14:120–129] |

## 7. 决策与证据隔离的收口条件

- 【角色提案】先裁定Q1–Q7中真正影响本次有界demo的项；决定排除的能力要写明排除原因，不把“未知”硬编码成零费用、固定NAV或退款成功。
- 既有规则保留其唯一作者位置；本设计只用坐标引用。获批新增行为再由对应owner回到唯一作者输入/手写边界，不并行维护本文为第二份执行真源。[S01:5–22]
- 源SHA只证明阅读版本；Mock回执只证明模拟外部结果；订单事件证明本地接纳；资金结果证明另由账务证据承担；这些都不能互相替代。[S01:15–22；S13:98–99；S14:120–129]
- 【角色提案】K1–K14的独立预期、实际候选实现、执行结果、失败/未执行状态分别签收；本轮全部场景状态为**未执行**，不存在新PASS或真实机构批准。
