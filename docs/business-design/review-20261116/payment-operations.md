# 付款、独立退款与运营恢复：有界用例设计提议

日期：2026-11-16。视角：虚拟支付账务清算专家＋运营对账负责人。
本文件是模拟业务设计候选，不是会议记录、执行真源、实施授权或验收回执；无真实机构、专家、监管者参与或批准。
仅保留现金申购、相关TA结果、独立全本金退款及有限定投的支付接缝；不操作真实资金，不新增金融政策。

## 1. 来源、身份与结论等级

- 【事实·声明】指本次直接读取的作者规则；【事实·实现】指直接读取的手写源码，二者不互相冒充。
- 【现有模拟假设】指可信演示配置或固定测试场景，不外推为真实银行制度。
- 【角色提议】指下面建议采用的业务步骤、观察口径和待执行案例；【未决】明确由谁继续提出答案，不默认为批准。
- 引用记法 `S01:15–19` 严格表示第9节S01对应的**绝对路径:行号＋完整文件SHA-256**；每个引用继承该行的SHA，不是仅凭文件名推断。
- 读取时银行HEAD为 `f8ac7ca882335a7c84cff7cbcb5100b6091b864a`；引用以实际工作树文件SHA为准，不假定所有文件都等于HEAD。
- 当前作者根为 `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/`；不建立第二当前输入。[D01:3–13；D02:5–11]
- `use-cases.yaml` 明说它是描述性导航，不是执行DSL、授权policy或审批记录；本题导航655–914行必须回到切片与实现核实。[N01:8；N01:655–914]
- 所有下列案例均**未执行**。本轮只读源码、计算来源摘要并写本文件；没有运行服务、编译、测试、类型检查或生成。

## 2. 已核边界：供用例引用，不另定义规则

| 编号／等级 | 源中实际内容与不能扩大之处 | 精确来源 |
|---|---|---|
| F01【事实·声明】 | 出款要求已初始化且resource相同、正CNY金额；同txid的已提交／预留／已补偿金额必须一致。Reserve同身份重复空成功，余额不足拒绝；Deduct必须已预留且未补偿；Release不得撤销已Commit出款。 | S01:15–19,26,47–55,86–93,127–137 |
| F02【事实·实现】 | 可用余额在Reserve时减本金，在incoming Commit时加本金；Release只加回实际预留，空释放不加钱。Deduct只转移预留到已提交记录，不再减一次可用余额。 | H01:7–20；S01:69–72,109–113,153–156；S02:102–112 |
| F03【事实·声明＋实现】 | `CASH_SOURCE_CONFLICT/ONCE/BEFORE_SETTLEMENT`保护完整original与先留存顺序；入站以principal＋clientRequestId派生身份、从可信配置取账户，验证原正文金额与付款金额相等。切片的`CASH_SOURCE_BODY`本身只比较币种等字段，不能独自证明金额正文相等。 | S05:14–20,41–47；H02:10–22,43–52；H03:22–35 |
| F04【事实·声明】 | 付款三参与者使用同一本金；募集户Commit后才订单Commit。耐久Commit决定后只向前恢复；未知先核实；取消前置留fence；恢复保持operation身份。 | S03:11–15,23–65,228–242,280–288 |
| F05【事实·声明＋实现】 | TA确认／拒绝关联订单、已成功paymentTxId、非空taRequestId、reference、产品、币种及回执；同receiptId异正文／异结果拒绝，已终态不接受另一新终态。accepted／unknown不是投资终态。 | S07:21–30；S08:21–30；H05:151–162,226–262 |
| F06【事实·声明＋实现】 | `REFUND_PAYMENT/TA_REJECTED/INTENT_ONCE`限制退款资格与唯一intent；账户和全本金取原订单，不接收新退款金额／目的地。独立退款交易不等于原付款交易，募集户出、原投资人入。 | S06:9–17,41–51；S04:11–20,54–67,115–146；H05:233–251 |
| F07【事实·声明＋实现】 | 退款结果有成功、效果前拒绝、已补偿、需恢复、结果未知；结果切片保护operation／receipt及首次终态，**不是余额核验器**。手写桥另核原交易、原拒绝、双边阶段证据及协调器状态后交付。 | S09:10–44,178–209；H04:41–49,73–87,127–184 |
| F08【事实·实现】 | 操作员恢复入口只收已有operation key，从原事件取付款／退款／期次参数；未授权拒绝，找不到返回MissingResource，读取／身份不可用返回Unavailable，不能由操作员传新本金或TA结论。 | H06:25–42,55–82 |
| F09【事实·声明＋实现】 | 两Saga都声明maxAttempts=1、phase/query=1000ms、backoff=0、total=10000ms；已有恢复循环每秒扫描、调用同源恢复，Reconcile参数32是交互预算。它们不是业务SLA或完整重试政策；retry/backoff/deadline债仍OPEN。 | S03:273–288；S04:176–191；H07:26–40,53–68；H06:25–30；D04:29–46 |
| F10【事实·声明＋实现】 | SIP同dueSlot已有occurrence时必须revision/config一致；新触发受顺序、backlog及revision区间约束。修订只允许effectiveSlot大于currentTick及latestEffectiveSlot，派款取留存occurrence.config。保留有限定投，不引入三败自动暂停。 | S10:16–27,54–61；S11:13–21,49–56；H03:64–68；D01:124–129 |

【现有模拟假设 M01】账户归属、基金对应募集户和authorityVersion来自演示配置，不是本轮做过实名／适当性审批；配置更换如何兼容原交易另见Q04。[H02:10–22,43–52]
【现有模拟假设 M02】TA使用显式配置的MockTA客户端及受信scenario，不能称为真实TA联调；本设计不要求现实机构接入。[H05:30–36,188–197；D03:82–85]
【现有模拟假设 M03】下述本金示例选固定测试已有的投资人1000.00、募集户0.00、单笔100.00 CNY；不是最低申购额、余额要求或费用政策。[T01:48–64,146–169；T02:25–45]
【未决边界】确认切片仅要求相关fundCode及非空shares/NAV文本，不能据此声称存在“本金＝份额×净值＋费用”规则，更不能推断交易日、NAV来源、费用或舍入制度。[S08:25–30]

## 3. 用例P01：受理原现金请求并完成付款，不承诺投资成功

【角色提议】目标：客户得到可追溯的一次付款，而非重复点击造成多次扣款；前置采用M01及F01/F03。完成条件分为“请求已受理”和“原付款已成功”，两者不可合并；TA结果另判。[H03:26–35；D02:26–27]

| 步骤 | actor／责任 | 业务决定 | 使用数据 | 结果及证据 |
|---|---|---|---|---|
| P01.1 | 客户表达购买意图；可信入站承担账户选择 | 是否属于受信客户、受信基金、合法正CNY金额；不得靠客户指定募集户 | principal、clientRequestId、fundCode、原MoneyWire、配置版本 | 允许后形成完整original；不满足即拒绝，不发起付款。F03；K01 |
| P01.2 | 现金入口／订单负责原请求留存 | 新请求、同内容重入还是同身份冲突；冲突不能覆盖原请求 | original及已留存cashRequestSource | 先留存再启动同一付款；同内容续接，异内容RequestConflict。F03；K01 |
| P01.3 | 投资人账务负责资金可用性 | 足额才预留全本金；不足不透支、不自动降低本次申购额 | 原txid、原投资人账户、原本金、可用余额 | 预留100.00后可用900.00；不足拒绝本阶段，不把待入款当资金。F01/F02；K02 |
| P01.4 | 募集户账务负责待入款；订单负责认领本次付款 | 三参与者是否都能承接同一本金与原资源 | 原付款身份、账户、订单、100.00 CNY | 保留各自Prepare证据；任何不确定进入P03，不宣称已付款。F04；K03 |
| P01.5 | 付款协调责任方决定继续提交；双边账务执行 | 已作耐久Commit决定则完成原交易，而不是改为撤回 | 同一原身份、决定与阶段证据 | 原投资人确认出款、募集户确认入款，再确认订单付款；900.00／100.00。F02/F04；K03 |
| P01.6 | 渠道解释结果；TA边界另负责申购终态 | 是否已有相关份额终态，而非是否收到技术ACK | 请求受理、付款结果、TA结果各自证据 | 建议分别显示“已受理”“付款成功，投资结果待确认”；不是新增状态枚举。F05；K04 |

- 【角色提议·替代】同身份同正文重入只续接原单；同身份异金额既不覆盖也不静默生成另一订单。拒绝后客户是否主动另发新购买，是另一意图，不由恢复程序代办。F03；K01。
- 【事实＋提议·失败】效果前拒绝或未Commit预留的释放，不等于独立退款；耐久Commit后禁止以“客户着急／超时”改走Release。F01/F04；K02/K03。
- 【生成／手写／独立预期】G：现有切片guards、事件槽、fold及Saga金额／顺序合同确定性派生；H：H02/H03入站与原单续接、H01金额计算及阶段I/O；O：K01–K03的固定金额、事件计数及顺序在结果读取前确定，不从生成输出反算。

## 4. 用例P02：可信TA拒绝后，独立退回原全本金

【角色提议】触发：已付款订单出现相关可信TA拒绝；不是客户取消按钮，也不是TA暂时无响应。受益人是原投资人；银行系统负责编排与交付，TA只提供申购结果。资格采用F05/F06。

| 步骤 | actor／责任 | 业务决定 | 使用数据 | 结果及证据 |
|---|---|---|---|---|
| P02.1 | TA接收边界／订单核对拒绝 | 回执是否属于已付款原订单；是否与已留存receipt或终态冲突 | order、paymentTxId、taRequestId、reference、receiptId/body、fund、currency、reason | 相关首次拒绝落事实；错误关联或冲突拒绝，不触发资金。S07:21–30；K04/K10 |
| P02.2 | 退款入口／订单保存唯一返还义务 | 原付款已成功且TA已拒绝，是否已有refund intent | 仅fundOrderId/paymentTxId；账户、本金从state取 | 生成唯一独立refundOperationId及pending；重入不产生第二intent。S06:9–17,41–51；K05 |
| P02.3 | 退款装配责任方验证原交易关联 | 是否真为原付款的反向全本金，而非替换支付或账户 | 留存付款、TA注册／拒绝、refund intent、独立退款transaction | 固定原collection→原investor、原100.00；装配不等于钱已退。H04:127–149；H05:233–251；K05/K10 |
| P02.4 | 募集户账务负责退款资金；投资人账务负责接收 | 募集户足额才预留；双方必须就同一退款本金形成阶段证据 | refundTxId、原账户、100.00 CNY | 双边Prepare后同一退款Commit；出款提交后只向前恢复。S04:54–173,183–191；K06 |
| P02.5 | 结果交付方记录；运营核对本金实际返回 | 是否有同身份双边Commit和成功结果，而非仅请求成功或父流程已启动 | 双边资金证据、退款协调状态、关联结果回执 | 投资人1000.00、募集户0.00；只追加退款成功，保留原付款成功及TA拒绝。H04:151–184；T02:33–45；K05 |
| P02.6 | 客户观察；运营解释异常 | 是否可以说“已退回”，还是仍需核实／处理 | payment、TA、refund三条结果及证据完整性 | 建议并列“原付款成功／TA拒绝／退款已完成或未完成”，不抹掉原交易。N01:768–841；K06–K08 |

- 【角色提议·失败】募集户不足只能解释为退款当前未完成；不减本金、不换退款目的地、不临时垫资。F01/F06约束本次可执行路径；是否另有资金处置由Q02承担。
- 【事实·失败】退款自身效果前拒绝或已补偿时，固定场景仍为900.00／100.00，退款成功事件为0；它只取消／释放本次反向交易，不是客户已收回本金。[T02:175–215]
- 【角色提议·替代】退款回执ACK丢失先核原结果再补交付；不铸新refundOperationId，不把相同本金退第二次。依据F07与H04:167–184；K08。
- 【生成／手写／独立预期】G：资格、唯一intent、原字段传播、退款两参与者和结果fold；H：H04的entry/query/execute/authority/deliver及H05原图续接；O：K04–K08/K10固定双边金额、原交易仍成功、唯一intent与原退款身份，各项独立断言。

## 5. 用例P03：处理未知结果、账务差异和原身份恢复

【角色提议】目标不是“把所有待处理变绿”，而是回答“钱是否预留、是否已转移、下一步谁负责”。触发为未知／需恢复／缺证据／不一致；不规定新的超时分钟数或自动重试次数。

| 步骤 | actor／责任 | 业务决定 | 使用数据 | 结果及证据 |
|---|---|---|---|---|
| P03.1 | 运营识别问题，系统定位原交易 | 请求是否可定位到已留存付款、退款或期次，而不是仅凭金额相同匹配 | 已有operationId；系统回查original及事务身份 | 不存在与暂不可读分开；不让操作员补填本金、目标或TA结果。H06:55–82；K10 |
| P03.2 | 系统取证，运营核对完整性 | “确实未执行”还是“查不到／查不全”；后者不能当零效果 | 原身份、双边阶段证据、Commit决定、结果回执与其关联 | 拒绝错资源／错phase；不完整保持待核实，不盲目重扣。H04:41–49,73–87,107–125；K06 |
| P03.3 | 账务核对者判断资金落点 | 可用、预留、已出未入分别是多少；准备入款是否被误当可用资金 | 第6节同一有界观测截面的余额与阶段记录 | 形成可解释差额；缺证据标“未证实”而不构造假账平衡。K02/K06；此核对表为提议 |
| P03.4 | 受信恢复调用者执行；运营只在授权入口请求 | 已Commit只向前；未知先查；安全未执行须有匹配证据才可同身份重发 | 原transaction／operation及授权核实材料 | 继续原付款或原退款；授权ACK只是恢复受理，不是资金成功。S03:280–288；S04:183–191；H06:25–42 |
| P03.5 | 运营负责解释及未决升级 | 是暂时不可用、真实拒绝、终态未退款，还是相互冲突的证据 | 当前结果、未完成阶段、最后可验证事实 | 暂时故障保留可恢复；冲突／不能自动履行的终态提交业务裁决，不手改账、不伪造成功。K06/K07/K10；Q01–Q03 |
| P03.6 | 系统再次核实，运营收口 | 是否具备与原交易相符的资金及结果证据 | 原身份、双边Commit、订单结果与回执 | 成功才结束相应用例；请求发出／循环ready／页面状态不能单独作为结束依据。H04:157–184；H07:30–34,59–68 |

【事实·实现】当前不是“所有恢复只能人工点击”：H07已有扫描驱动，H05已有订阅／轮询；但这些机制不能替代业务重试预算、退避和升级责任的决定。[H07:26–40,53–68；H05:55–76；D04:35–46]
【角色提议】运营工作单仅作为解释性材料，列原身份、已核事实、缺失证据、下一责任人、允许的原身份操作；不新建业务状态机或公共schema。
【生成／手写／独立预期】G：现有resultKinds及安全合同的显式部分；H：H06/H07调用、H04可信查询与H05恢复；O：K06–K08/K10逐阶段固定计数与错误分类。新升级流程未裁定部分不得生成，更不能借固定1秒循环当已选SLA。

## 6. 本金守恒与证据身份的具体口径

【角色提议】仅对M03的一笔付款及其独立退款、无其他资金进出、可重建的同一逻辑截面核对下表。数字由F02及原双边顺序推得；终态另有T01/T02/T03固定预期佐证，不是本轮运行结果。
`R`为该截面尚未释放／提交的出款预留；`T`为本事务已提交出款但尚无配对入款Commit的本金。
`T`只是建议的对账解释量，**不是当前已有清算账户、会计分录或新增持久状态**。缺少可信完整证据时不得把T填成0。

| 同一逻辑截面 | 投资人可用 | 募集户可用 | R | T | 本金核对 |
|---|---:|---:|---:|---:|---:|
| 付款前 | 1000.00 | 0.00 | 0.00 | 0.00 | 1000.00 |
| 投资人Reserve后；募集待入Prepare不增可用 | 900.00 | 0.00 | 100.00 | 0.00 | 1000.00 |
| 投资人Deduct后，募集户Commit前 | 900.00 | 0.00 | 0.00 | 100.00 | 1000.00 |
| 付款双边Commit后 | 900.00 | 100.00 | 0.00 | 0.00 | 1000.00 |
| 独立退款募集户Reserve后 | 900.00 | 0.00 | 100.00 | 0.00 | 1000.00 |
| 退款募集户Deduct后，投资人入款Commit前 | 900.00 | 0.00 | 0.00 | 100.00 | 1000.00 |
| 退款双边Commit后 | 1000.00 | 0.00 | 0.00 | 0.00 | 1000.00 |

- 【事实＋提议】`incomingCredits`的Prepare只留待入记录，不能与R重复算两份本金；`committedOutgoing/Incoming`是历史提交记录，不全量再加到可用余额。[S02:141–146；S01:69–72；S02:109–112]
- 【角色提议】解释性等式为“投资人可用＋募集户可用＋R＋T＝初始本金合计”；不能要求每个异步瞬间“两个可用余额之和恒定”，也不能拿跨水位页面拼出来的和判丢钱。
- 【事实】付款／退款交易身份必须分开；退款仍关联原paymentTxId、订单、原账户、原本金。阶段查询另核definition版本／摘要、argsDigest、participant、resource、step、phase。[H04:28–49,193–197；H05:248–251]
- 【角色提议】必须区分四类证据：源规则说明应做什么；手写代码说明如何连接；独立oracle事先固定应有结果；新执行回执才说明实际发生过什么。文件SHA只锁来源，不是资金正确性证明。[D02:13–22]
- 【生成／手写／独立预期】G不从本表生成新账本；H若以后实现核对器须独立授权；O使用下表固定数值与各txid证据，不调用H01金额计算或候选fold求期望值。

## 7. 拟采用的Given／When／Then案例及独立oracle

所有K编号均为【角色提议·未执行】；引用T类文件只证明已有固定预期文字，不声称它们本轮通过。G／H／O依次为确定性生成职责、手写职责、独立预期。

### K01 原现金请求重入与冲突（P01.1–2）
- Given：受信客户、基金及1000.00／0.00，clientRequestId=`request`，本金100.00 CNY。
- When：提交原请求两次，再以同key提交200.00。
- Then／O：重复接受原意图，变额RequestConflict；只一条Reserve和一条Deduct；最终900.00／100.00，原始查询仍为100.00。[T04:43–62]
- G：S05原请求留存；H：H02.cash/validateCash、H03.submit/getOriginal；O固定金额及计数不读取候选结果反推。已受理不替代TA终态。

### K02 预留、取消fence与不足额（P01.3、第6节）
- Given：分别使用独立场景A余额1000.00与场景B余额99.00；请求100.00；另有未执行的新txid作空释放。
- When：A预留两次，再同txid改101.00；B尝试预留；对空释放后的txid迟到Prepare。
- Then／O：A仅扣可用一次至900.00、R=100.00，101.00拒绝`LEDGER_RESERVEDAMOUNT_MATCH`；B拒绝`LEDGER_SUFFICIENT`，可用99.00、不产生Reserve事件；取消后的迟到Prepare空成功且无资金效果。[S01:127–155；H01:10–20；T03:37–47]
- G：出款guards/folds；H：H01及阶段执行者；O余额99.00场景为本轮新拟反例，不冒充既有固定测试覆盖；整个协议仍可另记取消fence事件。

### K03 付款最后确认与Commit后禁止释放（P01.4–5）
- Given：M03正常付款，募集户已产生入款Commit但其ACK尚未交付。
- When：先观察订单，再交付原ACK；付款完成后尝试对原paymentTxId执行Release。
- Then／O：ACK交付前订单付款Commit为0；之后双边900.00／100.00、投资人Reserve/Deduct与募集户Prepare/Commit各一次；原付款Release拒绝`LEDGER_NOT_COMMITTED`，不返100.00。[T01:84–111,133–169；S01:86–93]
- G：S03顺序、安全合同及S01；H：阶段执行／查询与H01；O独立有序收据清单，不用父流程Completed反证资金成功。最后的Release为新增拟断言。

### K04 TA未知不是拒绝，迟到拒绝须重新关联（P01.6、P02.1）
- Given：原付款已成功900.00／100.00，原TA请求仍accepted或unknown，无退款intent。
- When：一次TA查询仍未知；随后收到相关拒绝，再收到同receiptId异正文或一个相反终态。
- Then／O：未知阶段退款intent增量0、退款资金增量0；相关拒绝才允许唯一intent；冲突回执不覆盖既存拒绝，不能形成第二资金指令。[H05:226–262；S07:21–30；S08:27–29；S06:15–17]
- G：TA关联和退款资格；H：H05.resumeExisting与TA接收桥；O预先固定0／1 intent及原正文。无NAV、费用、交易日数值预期；新增组合案例待验。

### K05 独立全本金退款与重复恢复（P02.2–5）
- Given：M03付款成功、相关TA拒绝，保留原paymentTxId。
- When：完成原退款，并发重复resume八次，再从留存原图恢复。
- Then／O：1000.00／0.00；原payment结果仍succeeded；refundTxId不同于paymentTxId；退款intent、退款成功、募集户Deduct、投资人CommitIncoming各一次，恢复身份不变。[T02:25–68]
- G：S06/S04/S09；H：H04.entry/execute/authority/deliver、H05.finish；O固定双边金额及逐类计数，不仅检查`refundOutcome`。

### K06 未知结果按实际资金阶段核对（P02.4、P03）
- Given：各场景独立从M03的付款成功与可信TA拒绝开始。
- When：分别隐藏退款募集户Prepare、募集户Commit、投资人Commit的已发生收据，随后恢复可见并按原身份核实。
- Then／O：隐藏时均不宣布退款完成；阶段预期如下。重新可见后仍只一条intent、一次募集户Deduct、一次投资人Commit，最终1000.00／0.00。[T02:72–118,122–169]

| 已发生但观察受阻的位置 | 投资人／募集户可用 | R／T | 退款募集户Reserve／Deduct／投资人Commit计数 |
|---|---|---|---|
| 募集户Prepare | 900.00／0.00 | 100.00／0.00 | 1／0／0 |
| 募集户Commit | 900.00／0.00 | 0.00／100.00 | 1／1／0 |
| 投资人Commit | 1000.00／0.00 | 0.00／0.00 | 1／1／1 |

- G：S04安全合同／S09进展结果；H：H04.execute/query、H06.resumeRefund、H07扫描；O阶段计数已有T02:143–145，表内中途余额由F02独立算出，属于待增加的精确断言，不谎称固定suite已有全表。
- 未知是证据状态，不等于钱未动；同一“outcome-unknown”不能配一个固定“余额没变”oracle。

### K07 退款早拒绝／补偿不是退款完成（P02失败、P03.5）
- Given：付款已成功；分别在退款募集户Prepare前设取消fence，或在投资人Prepare前设取消fence。
- When：原退款运行及重复恢复。
- Then／O：结果分别rejected-before-effects／compensated；都保持900.00／100.00、原付款成功、退款成功事件0、intent一次；不能对客户说本金已退。[T02:175–215]
- G：S04/S09结果分层；H：H04.classify/deliver、H05.finish；O固定金额与成功计数0。该终态之后怎样履行未退义务由Q02决定，测试不授权新退款。

### K08 资金已返回、结果ACK丢失（P02替代、P03.6）
- Given：K05双边Commit已完成，退款成功事件已保存，但交付方未收到ACK。
- When：重交同receiptId、同正文及原退款身份的结果。
- Then／O：1000.00／0.00不变；退款成功事件总数1，双边资金Commit不增加，原付款结果保留。[S09:16–20,187–209；H04:167–184]
- G：结果幂等fold；H：H04.deliver和原图重接；O上述精确计数为新增故障窗预期，不冒称T02重复resume已等价证明ACK故障。

### K09 定投修订不得改写已发起付款／退款本金（保留范围的接缝）
- Given：封存有限slots=[10,20]，tick=10，slot10已留存revision A／100.00；未来revision B在20生效，金额200.00。
- When：重放slot10；再试图用B／200.00替换其occurrence；原slot10随后发生退款。
- Then／O：原重放不新增occurrence；替换拒绝`SIP_OCCURRENCE_REPLAY_CONFLICT`；slot10现金输入及原退款仍100.00，不因未来配置改成200.00。[S10:18–27；S11:14–21；H03:64–68；S06:44–46]
- G：S10/S11及退款原字段传播；H：H03.submitOccurrence与原退款桥；O固定slot/config/金额身份，此组合未执行；10/20仅显式逻辑slot，不推定现实日历，也不引入三败暂停。[D01:124–129]

### K10 关联错误与恢复越权（P02.1–3、P03.1–2）
- Given：一笔既有100.00独立退款；另有无权限操作者和不存在的operation。
- When：分别替换原paymentTxId／本金为101.00，或以错误resource／phase查询；再请求越权或不存在的恢复。
- Then／O：退款entry不接受变额、替换付款不装配；错误阶段／资源不取得可信收据；越权NotAuthorized，不存在MissingResource；资金仍按原交易，不增加新退款。[T02:46–51；H04:41–49,127–149；H06:55–82]
- G：资格与协议字段；H：H04验证、H06.reconcileExisting；O预期拒绝类型及资金增量0分别固定。读取失败应为Unavailable而非MissingResource；不能用一个“失败”断言掩盖分类。

## 8. 本角色承担的未决问题与建议取舍

| 编号 | 必须回答的问题／本角色建议 | 需要的决定与独立预期 |
|---|---|---|
| Q01【未决】 | 重试次数是否含首次请求，query/execute是否分别计数，怎样跨重启保留预算？现有1次／1秒／32不能拼成业务政策。建议先保留“未知核实、Commit向前、同身份”底线，不选拍脑袋的分钟阈值。 | 我负责提交付款／退款暂时故障分级方案，主集成协调业务owner裁决；决定后另写预算耗尽、重启再耗尽、暂时失败后成功预期。依据F09。 |
| Q02【未决】 | 已可信拒绝但退款本身早拒绝／补偿终止时，唯一intent已经存在，原本金尚未返回；是否仅列运营待处置，还是允许另有版本化后续业务？建议本轮止于“未退、需裁决”，不自动造第二退款或垫资。 | 我负责给出余额、原义务和允许后续动作清单；业务owner决定边界后才有新用例。当前K07不应被改成“客户已退款”。依据S06:17；T02:175–215。 |
| Q03【未决】 | TA先确认后拒绝、不同receiptId互相矛盾，或原资金证据冲突时由谁核定事实？建议保留原终态并隔离冲突，不让操作员选择想要的答案。 | 我负责运营解释与禁止动作，需TA业务owner提供可验证结果契约；已有关联拒绝规则不等于争议处理政策。依据S07:27–30；S08:27–30。 |
| Q04【未决】 | authorityVersion更新后，旧original仍须等于当前config.version，旧付款／退款怎样继续？建议明确版本留存责任，不改旧original凑通过。 | 我负责提出原交易证据要求，配置owner决定版本兼容；增加“旧单＋新配置”独立预期前不声称支持。依据H02:43–52；H03:56–61；H05:121–129。 |
| Q05【未决】 | 运营怎样取得同一逻辑截面的双边证据，怎样标识观察不完整？建议采用第6节分阶段核对，不以读侧单行成功或两个不同水位余额结案。 | 我负责定义最小核对材料；读侧owner决定可交付观察接口。此处不新增公共schema、SQL或另一份当前真源。 |
| Q06【未决】 | TA确认本金、份额、NAV、费用之间究竟采用什么模拟业务合同？现有非空文本规则无法回答。 | 本角色只核现金本金不混入估值；由产品／TA owner提出显式方案，我再核资金影响。不得补造零费率、T+N、默认净值或舍入。依据S08:25–30。 |

【角色提议·拒绝方案】不采用“未知就新扣一笔”“付款Commit后走原TCC补偿”“退款已补偿＝客户到账”“把轮询次数当业务重试”“三败自动暂停”。分别受F04/F06/F07/F09/F10约束。
【实施边界】G只消费已显式确定的规则，不从本文件散文猜政策；H及其测试同属手写维护，独立O不随生成结果改写。[D03:49–59,80–85；D02:13–22]
【停止点】交付的是P01–P03、SIP支付接缝、K01–K10和Q01–Q06候选；未写作者树、绑定、生产／生成代码、图、oracle、固定测试或公共业务表达设计，也未重签历史验收。

## 9. 引用索引：绝对路径与源文件SHA-256

以下均为本次直接读取文件的内容摘要；行号见正文。N为描述导航，S为作者声明，H为手写实现，T为固定测试文本，D为边界合同；类别不能相互代替。

| 引用 | 绝对路径 | SHA-256 |
|---|---|---|
| D01 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/AGENTS.md` | `d06ea3445bd1f2e3230c104fe140fb7379d31dd9af018fc03a069fda7731b26c` |
| D02 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/TRUTH.md` | `22ff12d956f30fb46abc5d919255b58f1f1cf3c9be338b4d045e466a1b522520` |
| D03 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/docs/FUND-PURCHASE-BUSINESS-DELIVERY-20261115.md` | `b02e381b853748507e2ea8c4e987fb6913123b57887a2818facb836e8e566ec4` |
| D04 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/docs/TRUTHSRC-CONTINUATION.md` | `ca13ab984b796623b8e149577ee90c2ef3156f0fd13958ac2df3f15b8100d204` |
| N01 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/use-cases.yaml` | `531663b9e938256b465d3b302a4d5e6798aacb689cd198a795668764aadb3b5e` |
| S01 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/structures/outgoing-funds.structure.yaml` | `825c0141d95f6a02418424aa8e0d43dd30a5bbae607f6deb5a02efde3effa720` |
| S02 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/structures/incoming-funds.structure.yaml` | `1fad9443647ffe14ecce11b85382f27767b51e1098504d1c45c055ed8497efb0` |
| S03 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/sagas/bank-cash-payment-v1.saga.yaml` | `9df6b256506669f8e0f40900bb37cb77696c9f1a17eaa13f229a054d43b2fb0d` |
| S04 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/sagas/bank-independent-refund-v1.saga.yaml` | `dd30368acfe82d5124aeba4778a03a44a51d9ad35684e93584c39fce19542942` |
| S05 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/record-cash-request-source.slice.yaml` | `55119a58a3440d079af5cc647202fef6e7b3951835a6097950dc34c07fdd3252` |
| S06 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/request-fund-purchase-refund.slice.yaml` | `6977766c5484f0c003451f5df93102acd3efd6d3102d5d7c14960f66ed6fdfb8` |
| S07 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/record-fund-ta-rejected.slice.yaml` | `a0ae573010d324fe6920eb7f5884c67015c9eaa75f95e9be79e69cea490c97fe` |
| S08 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/record-fund-ta-confirmed.slice.yaml` | `5f06801a987491448c7a79c92c314c00b3f71c90eac2425a679ce23276280793` |
| S09 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/structures/refund-results.structure.yaml` | `0ed5959fb8377c5af0918f841edead825d240011a802ed66ee2c5f3870acfe04` |
| S10 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/trigger-sip-installment.slice.yaml` | `7499c577498e085c8ff8246c5d633ad1c9106df458e219553f5eb9f3000c5419` |
| S11 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/revise-sip-plan.slice.yaml` | `7e1714c020b34d9b9adb8daf93ed91aad9cf953606c6c47c2ad8a8de09d884d8` |
| H01 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/BankBalanceComputations.scala` | `ceb8afd93202ceb3da389e3e4edc7f612a5512894a9b2af7c55e622874732b3e` |
| H02 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankTrustedAdmission.scala` | `6a861c4f8e6b3920a32136a324506a3b17b0a91a917eefdc48bd332550a4abef` |
| H03 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankCashRequests.scala` | `21cf50e66468caec589e83a20f5fa92806eb2c52913cfc7016df68f460e0b1d9` |
| H04 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/BankRefundBindings.scala` | `db413dbdaa669ff9b99eb58af23a07c517a7374ada76dbfd4f2389d2a0c253eb` |
| H05 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/ta/BankTaRefundApplication.scala` | `579a2d43451f9c7be63ffd6dbcc156813803664e903ef1b0c03c913648b3719f` |
| H06 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankRecovery.scala` | `b9eecf80581d0a2d3877ff7426c23d37253e63bc46459f4308b91091b4402b2f` |
| H07 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankRecoveryLoop.scala` | `006f4a72315b370f28ec3aa1db05552c50847f4ea3c407dd1f030e330806b15f` |
| T01 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankSinglePaymentOracleSpec.scala` | `81873a3e8755adacf9a6538065924c4208cb2226dc4c7a5001e094481c6fcc23` |
| T02 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankRefundApplicationSpec.scala` | `6beead5ecfad21293d77022d754734b27720774f94a653d1d817a29b3a737acf` |
| T03 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankBalanceStateSpec.scala` | `7bf15205d745f7ee146127ef13961c503ad71262091a792ca4f61a1c4f4c568f` |
| T04 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankPaymentRecoverySpec.scala` | `9a70e7a02147c9e5995857b2f7dea7294c8df3ce31d1fd2bdbbcdb5f5f91fcc5` |
