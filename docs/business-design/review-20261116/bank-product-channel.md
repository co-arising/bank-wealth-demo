# 现金申购与有限定投：客户承诺和操作步骤提案

- 日期：2026-11-16；角色：**虚拟银行财富业务负责人＋客户/渠道挑战者**。
- 状态：仅获模拟业务设计授权；本文是待裁决的有界用例提案，不是会议纪要、真实银行政策、合规意见、专家签收或实施授权。没有真实机构、专家、监管者参与。
- 本轮仅静态阅读来源并保存本文件；没有编译、生成、测试、服务或业务交易执行，不标 PASS，不继承历史验收。
- 唯一当前作者根仍为 `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/`；本文不进入编译输入，不复制第二棵真源，不定义公共 schema。
- 标记：**F＝显式来源事实**（再区分声明/实现/固定测试预期）；**A＝现有模拟假设**；**P＝本角色提案**；**Q＝未决问题**。源码含规则不等于真实机构批准。
- 引用约定：`Sxx:行号`完整指向第9节该项的**绝对文件路径:行号＋全长源文件 SHA-256**；后文复用 F 编号即复用其证据，不把叙事升级成执行政策。

## 1. 先固定客户真正要完成的事情

**P1 客户目标**：用指定的一笔本人现金申购指定基金，知道银行是否保留了原意图、是否完成付款、TA是否确认份额；失败时知道钱是否仍被占用或已退回，而不是只看到“请求成功”。
**P2 完成条件**：投资成功只以与原付款关联的可信 TA 份额确认为依据；付款失败或“TA拒绝且退款完成”是失败闭环，不把“钱回来了”说成投资成功（F6–F8）。
**P3 中间交付**：受理回执是“银行已记录并启动处理该请求”的承诺，不保证成交、收益、具体确认日期或退款时限；它与最终业务结果分别呈现（F4）。
**P4 范围**：保留现金申购、模拟 TA、独立退款和有限定投；本提案不增加赎回、客户现金撤单、无限自动续投、交易日历或计价政策。TA可以模拟，但不能伪造确认事实（S01:24–30；S03:78–85）。

## 2. 可承接的事实与模拟假设

| 编号/层次 | 实际来源支持什么；不能扩大成什么 | 精确来源（SHA见第9节） |
|---|---|---|
| F1 实现 | 现金 DTO 只收 `clientRequestId/fundCode/amount`，amount只收 `minorUnits/currency`；可信入站由客户身份和基金配置补出账户，要求正 CNY、出入账户不同。不是客户适当性或产品销售资格证明。 | S28:102–114,157–164；S05:10–23,43–52 |
| F2 实现 | 现金 order/operation 由种类、principalId、clientRequestId确定；正文不参与身份派生。新请求号不是原请求的技术重试。 | S07:8–24 |
| F3 声明 | `CASH_SOURCE_CONFLICT`比较留存的完整 original；`CASH_SOURCE_BEFORE_SETTLEMENT`要求首次留源先于结算；`ORDER_REPLAY_CONFLICT`拒绝同订单异付款参数，同参重入无新事件。 | S08:14–20,45–47；S09:18–24,63–69 |
| F4 实现 | cash.submit先留源、读回并验证，再start；只有匹配的耐久 RunStarted存在才返回 `accepted`。留源后或启动后响应异常仍可能返回Unavailable，不能据此判定未受理或未扣款。 | S06:22–35,72–87 |
| F5 声明＋实现 | `LEDGER_SUFFICIENT`在资金预留时检查余额；同txid同金额重复不再预留。可用额在预留时减少，Deduct仅移除预留并登记已提交出款。可用额下降不单独证明付款完成。 | S10:15–19,47–72,127–155；S11:10–19 |
| F6 声明 | 三方使用相同本金，订单提交晚于募集户提交；付款succeeded要求订单commit证据。取消不能撤销已commit订单，释放预留不能补偿已commit出款。五类付款结果不是一个成功布尔值。 | S14:11–14；S13:48–114；S12:51–56；S10:86–93 |
| F7 声明＋实现 | TA确认要求原订单、已成功的selectedPaymentTxId、原taRequestId、基金币种和回执关联；桥还向模拟TA查询核对权威回执全文及原本金。accepted或unknown不能代替confirmed。 | S15:21–30,70–75；S16:36–60,105–162 |
| F8 声明＋实现 | 退款意图只允许原付款成功且TA rejected；账户、本金从原订单取，首次退款还核唯一权威拒绝。已有退款意图重接原身份；不是让客户重新填收款人，也不是撤销原付款事实。 | S17:14–17,41–51；S16:84–103；S32:25–45 |
| F9 实现 | SIP创建为非空、最多1024项、严格递增的有限dueSlots，均不早于非负effectiveSlot；原完整意图持久化后恢复精确前缀并封口，create accepted不是任一期付款完成。 | S05:54–65；S18:89–134 |
| F10 声明＋实现 | 新revision的effectiveSlot必须严格大于currentTick及latestEffectiveSlot；同revision异配置拒绝。期次只取所属半开区间配置；同dueSlot异revision/config重放拒绝，同配置重复不新建。 | S20:13–21,52–56；S19:16–27,54–61；S18:227–235 |
| F11 声明＋实现 | 暂停使用已留存tick；既有backlog不改成跳期，暂停期间新分类的到期slot为skipped。恢复先完成暂停段分类，不复活已跳期；已派发期次继续独立处理。 | S21:13–18,47–49；S23:16–22,55–57；S22:13–17；S18:155–175,217–256 |
| F12 声明＋实现 | 首次可信TA确认才计success；早拒绝、付款补偿或TA拒绝且退款完成才计failure。unknown/待退款不计终态，重复终态不再计数；failureTotal不被成功清零，失败fold不设置paused。 | S24:26–101；S25:17–24,61–65；S26:17–24,61–65；S02:124–129 |
| F13 实现 | 当前页面显式输入原请求号，提供现金提交/原单查询及SIP修订/暂停/恢复；服务绑定没有现金取消/现金修改端口。页面忙碌时挡本页提交，网络失败不推断业务成功。不能由此宣称跨标签页、跨会话防重复已完成。 | S29:19–48,299–304,335–343；S27:30–72 |

- **A1 可信演示账户/基金**：现有模拟准入依赖配置中的customer、fund与authorityVersion，而非真实开户/适当性/销售许可核验；“配置存在”不能写作“所有资格已审核”（F1；S05:43–65）。
- **A2 有限业务slot**：操作员显式tick驱动，现有应用不在该入口按自然日自动推算期次；slot不能直接标为交易日或T+N承诺（S18:178–202；S04:950–952,1132–1164）。
- **A3 TA样本不是估值政策**：固定测试给出的份额/NAV文本为`80.0000/1.2345`；它证明应保存这些样本文本，不证明本金与份额之间的计价关系，更不能把差额解释为费用（S31:320–323；S16:147–150）。
- **F14 导航边界**：现金S04:11–345和SIP S04:918–1544是描述性阅读主线；文件自己明确不是执行DSL、授权policy或审批记录（S04:3–8）。

## 3. UC-C：提交一笔现金申购并辨认最终结果（P）

触发：客户决定使用本人现金申购；前置：F1对应的可信演示身份和映射可用，客户明确基金和金额。
输入：客户只提交原请求号、基金代码、精确金额；银行补齐原账户/付款身份及配置版本，不让渠道代填机器结果。
正常结束：相关TA份额确认；失败结束：有证据的付款失败，或TA拒绝后的独立退款完成；没有结果时保持未决，不伪造结束。
下表是业务步骤提案，调用现有事实不等于新增实现已获准。

| 步骤 | 主体及责任 | 决定、业务数据 | 结果及客户承诺 | 实现/预期分工 |
|---|---|---|---|---|
| C1 确认意图 | 客户决定买什么、花多少；渠道复述 | 显示基金、CNY金额、本人账户提示及“受理不是投资成功”；首次发送前固定本次请求号 | 客户确认的是这一笔意图，不是每点一次按钮买一笔 | H：确认与草稿交互；I：B01/B03 |
| C2 接受或拒绝输入 | 银行可信入站负责身份、账户及产品映射 | 执行F1；非客户/未配置基金/非法金额不进入付款；不冒充适当性决策 | 给出输入或权限拒绝；不能把所有拒绝都文案化为“余额不足” | G：已声明载体；H：入站；I：B05 |
| C3 留存原请求 | 银行负责把客户意图和执行参数固定下来 | 执行F2/F3；同身份检查完整original，不以新正文重铸操作 | 首次留存CashRequestSourceRecorded；冲突不覆盖原单 | G：guard/event/fold；H：调用与读回；I：B03/B04 |
| C4 返回受理回执 | 银行负责启动同一笔付款处理 | 按F4核匹配耐久启动；回执含原请求和订单关联 | 显示“请求已受理，付款与投资结果请分别查询”，不显示“购买成功” | G：结算请求决定；H：启动与回执；I：B01 |
| C5 执行现金付款 | 银行资金侧决定能否预留并完成原本金划转 | 按F5/F6核余额及各方结果；预留、出款、入款、订单付款确认分别可辨认 | 只有相关付款succeeded才显示“付款完成，投资待确认” | G：领域/事务声明；H：资金适配与计算；I：B02/B05 |
| C6 请求TA处理 | 银行负责按原已付款订单提交；模拟TA负责受理/拒绝/确认 | 按F7，保留原请求身份、本金和基金，accepted只表示进展 | 显示“TA已受理，份额待确认”或“结果待核实” | G：TA guard/fold；H：权威查询与桥；I：B07/B08 |
| C7 交付投资结果 | 银行负责校验和转达相关最终确认 | 相关confirmed才更新确认份额；显示收到的精确文本，不自行算NAV/费用 | “本笔份额已确认”；不承诺收益，不把状态当完整持仓系统 | G：F7状态演进；H：结果呈现；I：B08 |
| C8 失败后独立退款 | 银行对资金去向负责 | 相关TA rejected后按F8发起原本金反向退款；结果仍可未决 | 先“投资未成立，退款处理中”，证据完成后才“本金已退回” | G：退款意图/结果；H：退款接线与关联；I：B09 |
| C9 客户回查 | 渠道负责让客户按原单继续理解结果 | 展示原请求、付款、TA、退款和查询新鲜度；不把GET变为重试POST | HTTP错误、读侧未追平、业务unknown、业务拒绝分别解释 | G：既有载体；H：查询消费与文案；I：B06 |

### 替代与失败路线（P，沿F事实约束）

- **C2a 资格不明确**：本demo只能判定F1，不能返回“风险测评通过”。需要现实资格的场景停止在Q1，不让技术认证替代业务资格。
- **C3a 重复点击**：已发送意图的重试复用原ID及原DTO；同正文返回/追查原单，同ID改金额进入冲突说明。按钮禁用只改善本页体验，不是资金幂等依据（F2/F3/F13）。
- **C4a 留源或启动后丢响应**：提示“受理结果未确认，请查原请求”；允许原样重试，但不自动换ID。查询未找到且水位不确定时仍不能确认未执行（F4；查询语义提案见P5）。
- **C5a 余额不足**：只有关联到该笔的余额拒绝证据才解释为余额不足；客户可了解结果后另作新意图，但系统不自动充值、不在UNKNOWN时重扣（F5）。
- **C5b 部分阶段失败**：技术取消/补偿不是客户撤单；付款compensated与独立退款succeeded分开，不能只因流程结束就称“退款到账”（F6/F8）。
- **C6a TA只受理/超时/unknown**：继续核同一taRequestId，不推定拒绝或退款，不许渠道输入一个confirmed替代外部证据（F7）。
- **C8a 退款未知或补偿**：仍未交付退款成功；客户资金问题保持可见，由银行查原退款，不能新造第二笔退款（F8；S32:191–205）。
- **C9a 配置变更后的原单重试**：当前validate要求原authorityVersion等于当前配置版本；冲突/不可用可能是版本问题，不据此新铸订单；如何接续由Q4裁决（S05:43–52；S06:49–51,56–61）。

### 客户可见状态不是新持久化枚举（P5）

| 证据条件 | 建议表达 | 绝不能据此承诺 |
|---|---|---|
| 客户仅点击、没有可靠响应 | 受理结果未确认；查原请求 | 尚未扣款、可以放心另下一单 |
| F4 accepted且尚无付款终态 | 已受理，付款处理中 | 扣款完成、投资成功 |
| F5仅有资金预留 | 资金已预留，付款结果待确认 | 募集户已到账 |
| F6付款succeeded | 付款完成，投资待确认 | 已获份额 |
| F7 TA accepted / unknown | TA已受理待确认 / TA结果待核实 | 投资成功、TA已拒绝 |
| F7相关confirmed | 本笔份额已确认，显示TA原文本 | 收益、估值、费用规则已验证 |
| F8 rejected，退款未成功 | 投资未成立，本金退回尚未完成 | 本金已到账 |
| F8独立退款succeeded | 投资未成立，原本金已退回；原付款事实保留 | 原付款从未发生 |
| 查询暂不可用/未追平 | 当前结果不可确认，保留原请求入口 | 把查询故障改写成业务失败 |

## 4. UC-I：重试、另下一单、取消及修改（P）

1. **客户＋渠道辨认意图**：先问“继续查询这笔、重试这笔，还是确实再买一笔”；输入是原请求摘要与当前输入，不是只检查两个金额是否相等（F2/F3）。
2. **查询原单**：只读原请求并显示原金额/基金；查询失败不启动付款。拟优先引导此路线，不能宣称现有浏览器已保存跨会话草稿（F13）。
3. **重试原单**：渠道发送固定ID及原DTO；后端用原留存做决定。不得用“重试次数”拼operationId；异正文返回冲突并保留两份可对照的意图，不修改银行原单（F2/F3）。
4. **另下一单**：客户明确确认新增交易后才使用新clientRequestId；须提示可能与未决旧单并行。这个确认交互是提案，不是现有后端跨ID去重政策。
5. **未发送草稿**：建议允许取消/修改本地输入，产生零银行命令；不是金融撤单。若无法证明尚未发送，转原单查询而非宣称取消成功。
6. **已发送现金请求**：建议本有界demo不提供修改原金额/基金或客户撤单承诺；现有取消fence只保护事务阶段。若要开放真实撤单，先裁定可撤时点、资金责任和竞态，不能直接暴露CancelCashFundSubscription（F6/F13；Q2）。
7. **已付款或TA accepted**：既不允许把现金请求修改成另一基金，也不把“取消”翻译成独立退款；F8并未授权客户意愿作为退款条件。
8. **职责**：银行拥有原请求和资金结果；渠道拥有本次意图确认、请求号复用和错误提示；客户端缓存不成为新的业务真源。

## 5. UC-S：有限定投复用现金承诺并管理未来（P）

| 步骤 | 主体/责任 | 决定与数据 | 结果/边界 |
|---|---|---|---|
| S1 创建 | 客户给出有限日程、金额和基金；银行保存完整意图 | F9校验并封口；显示实际dueSlots和初始配置 | 计划受理不等于首期投资成功，也不承诺自然日历 |
| S2 到期 | 操作员推进业务slot；系统按序分类 | 显式tick、已封口日程；按F10先留存occurrence再派发 | 每期复用现金路径；不因前期尚无TA终态而把后期偷偷删除（S18:243–255；S06:64–69） |
| S3 修订 | 客户说明未来基金/金额变化；银行验证本人原计划 | F10未来边界；渠道复述生效slot、旧新区间和不受影响的旧期次 | 返回revision受理；不是改写既有现金订单或改写dueSlots（S18:137–152） |
| S4 暂停 | 客户希望停止后续派发；银行解释F11 | 使用已持久tick，保留backlog和in-flight，暂停段新到期项跳过 | 必须明示“已发起交易继续；暂停不是撤回扣款授权的追溯撤单” |
| S5 恢复 | 客户希望继续未跳过的后续安排 | 暂停段先分类；不复活skipped；既有backlog按原区间配置处理 | 显示将继续哪些项，不能宣称补买全部暂停期 |
| S6 逐期交付 | 银行把相关付款/TA/退款证据带回期次 | F12首次终态计数；未决继续显示 | “日程已派发完”与“所有投资已结束”分开；不加三败自动暂停 |

修订替代路线：同revision同配置为原动作重放；同revision改配置拒绝；新revision生效slot等于或早于currentTick/latestEffectiveSlot拒绝（F10）。
暂停替代路线：没有满足guard的已持久非负tick时不能用墙钟补值；渠道应说明当前无法暂停并保持原结果，不假装暂停成功（S21:17；S18:159–163）。
客户挑战：恢复backlog可能连续触发多笔扣款；建议恢复前显示受影响项和金额，不引入未批准的限额、合并扣款或等待前一期终态策略。

## 6. 每类行为的确定性生成、手写实现与独立预期

G/H/I是拟实施责任，不是本轮已经生成或验证；业务决定未裁决的部分不能先硬编码进模板。

| 行为 | G：可由已有显式输入确定性产生的内容 | H：保留/拟补手写职责 | I：独立预期，不由G输出反算 |
|---|---|---|---|
| UC-C受理/身份 | F3结算guard、事件及fold，已有DTO形状 | 现有入站映射、BankCashRequests留源/启动；拟补意图确认 | B01/B03/B04中先固定原DTO、事件数量、原ID比较 |
| UC-C付款 | F5/F6规则和状态演进、明确事务合同 | 当前BalanceComputations及资金适配；不由本文把host擅迁生成侧 | B02的1000→900、0→100及各一次；B05拒绝不改状态 |
| UC-C TA/退款 | F7/F8 guard、关联字段、结果fold | TA权威查询、解析、退款接线；模拟选择属于可信部署侧 | B07–B09固定状态/原文/反向本金，不用实现重算份额 |
| UC-C查询与文案 | 已声明类型/字段；没有据本文生成新SQL或政策 | 读侧消费、状态解释、未追平/未知区分 | B06与P5明确输入证据→展示类别；资金效果为零 |
| UC-I重试/取消/修改 | 复用F2/F3/F6，不生成新的现金取消API | 请求号生命周期、确认新增交易、本地草稿放弃交互 | B03/B04/B10的POST数量和固定正文；不读生成快照当答案 |
| UC-S有限定投 | F9–F12中显式guard/event/fold及期次声明 | 可信所有权、原日程恢复、时钟/派发/终态桥、影响预览 | B11–B13先写slot→金额、跳期集合和计数常量 |

新增Agent实现和测试仍属手写维护所有权；确定性可生成部分不因“要丰富业务”全部迁出。公共业务表达能力由独立owner处理，本文不补新语法（S03:80–82；S01:13–22）。

## 7. 拟验收用例：Given / When / Then与独立oracle

全部**未执行**。这是待授权的用例数据，不创建/改写固定测试或金融oracle文件。
基准现金样本：本人演示账户1000.00 CNY、募集户0.00，基金`FUND-中文-001`，付款100.00；已有独立测试先写定900.00/100.00及三方各两条收据（S30:26–32,48–64,144–169）。
身份预期采用“发送前固定请求号、第一次可靠留存的原身份，后续逐项比较”并独立检查次数；不能调用生产identity函数再把其输出自证为预期。精确identity字节金样若要验，须另外独立编写，本文不编造SHA输出。

### B01 受理不等于付款（UC-C；G＋H）
- Given：基准请求`cash-a`；拟故障夹具允许匹配的耐久启动，但在任何付款Prepare前阻住资金执行。
- When：客户提交并收到accepted。
- Then：原请求可关联；尚无付款succeeded、TAconfirmed或退款成功；文案只称受理。
- 独立oracle：受控暂停点余额仍1000.00/0.00、预留与出款数量0；accepted条件取F4，余额不变前提是夹具明确阻止资金执行，不从accepted本身推导。

### B02 完成付款仍待投资（UC-C；G＋H）
- Given：基准样本，TA尚无确认；When：原100.00付款完成。
- Then：付款succeeded，客户看到待投资确认；没有确认份额。
- 独立oracle：900.00/100.00，投资人reserve/deduct各1、募集户incoming/credit各1、订单subscribe/pay-order各1；余额和顺序来自固定预期而非调用余额计算函数（S30:133–169）。

### B03 同一意图重复点击/ACK丢失（UC-I；G＋H）
- Given：`cash-a`原请求已留存，首次响应丢失，配置不变；When：并发重发8次同ID同DTO，随后只读查询。
- Then：仍为原订单/operation，不因一次Unavailable增开单；最终结果沿原单取得。
- 独立oracle：留源及结算请求各1，单笔基准付款终了仍900.00/100.00，非800.00/200.00；G检查F3，H检查F4及实际重入路径。8为新场景次数，不是既有重试政策。

### B04 同ID改金额不是修改订单（UC-I；G＋H）
- Given：`cash-a`已留存100.00；When：同ID提交101.00，或换基金。
- Then：请求冲突，原基金、100.00及原身份不变，不追加第二付款。
- 独立oracle：原单快照逐字段不变，新留源/结算事件0；金额变体承接S09:20–21和固定测试S30:194–203，渠道提示是本提案。

### B05 余额不足与准入失败分开（UC-C；G＋H）
- Given：已初始化且可用90.00 CNY，无本txid预留；When：资金侧ReserveFunds请求100.00。
- Then：`LEDGER_SUFFICIENT`拒绝；独立oracle为余额90.00、预留0、出款0，不从HTTP冲突推断余额不足（S10:127–155）。
- 另给未配置基金/非customer的现金输入：入站拒绝、付款启动调用0（S05:10–25）；它们不能使用余额不足文案。

### B06 查询不可用与业务未知分开（UC-C/UC-I；H）
- Given：付款结果未决，查询先返回不可用或未追平；When：客户点“查原单”。
- Then：展示“目前不能确认”，保留原请求号，不显示投资失败或自动改ID重买。
- 独立oracle：该交互新增付款/退款POST均0；之后读到原付款成功只更新展示，不再扣款。此为P5渠道合同，非本轮读侧实测。

### B07 TA accepted不触发成功或退款（UC-C；G＋H）
- Given：基准付款成功且模拟器采用accepted-only样本；When：接收受理并重复查询。
- Then：TA仍accepted、份额为空、退款意图为空；独立oracle为900.00/100.00，投资成功次数0（S31:391–402；F7/F8）。

### B08 可信份额确认及错误关联（UC-C；G＋H）
- Given：相关原单及模拟TA权威confirmed样本；When：桥核原付款/基金/本金后摄入。
- Then：保存`80.0000`与`1.2345`原文本，确认此笔份额；同receipt重放不新增确认（S31:320–323；S15:21–30）。
- 独立oracle：两个文字常量逐字符相等、首次确认1；替换paymentTxId或fundCode则拒绝、状态不变。**不**用100÷NAV计算份额，也不凭差额生成费用。

### B09 独立退款不是原付款被撤销（UC-C；G＋H）
- Given：已付款100.00且可信TA拒绝；When：独立退款完成，再重入8次。
- Then：付款仍succeeded，退款succeeded，投资未成立；独立oracle为1000.00/0.00，退款txid不同于付款txid，退款意图/成功及反向两方资金提交各1（S32:25–56）。
- 若退款仅unknown或compensated，不标本金已退；失败样本保持900.00/100.00及退款成功事件0（S32:191–205）。

### B10 取消草稿不冒充现金撤单（UC-I；H）
- Given：一份明确未发送草稿；When：客户放弃；Then：银行命令0、页面只称草稿已放弃。
- Given：原单已发送且结果未知；When：客户要求取消或改基金；Then：没有取消/退款POST、原ID与正文不变，说明当前范围并引导查原单。
- 独立oracle：两类动作各自的网络调用清单为空；第二类不能文案化为“订单已取消”。这是一项待Q2裁决的产品行为，不宣称已有撤单政策。

### B11 修订未来而非重写旧期次（UC-S；G＋H）
- Given：有限slots `[10,20,30]`，初始effectiveSlot=0、每期100.00；tick=10且slot10已留存；When：新revision `r2`从20起每期200.00，再tick20。
- Then：slot10仍原身份/100.00，slot20取r2/200.00；独立oracle为`{10:100.00,20:200.00}`，不是从生成occurrence读回作为预期（F10）。
- 同r2改201.00拒绝；新revision生效10拒绝；原slot10同配置重放零新增，换r2/config重放拒绝。保持原dueSlots，不添第四期。

### B12 暂停不撤在途，恢复不复活跳期（UC-S；G＋H）
- Given：slots `[10,20,30]`，tick10已派发slot10但TA未终态；When：pause于已存tick10，tick20，resume于20，再tick30。
- Then：slot20为skipped且无现金订单，slot10继续核实，slot30可派发；独立oracle为派发slot集合`{10,30}`、跳过集合`{20}`（F11）。
- 暂停前已分类backlog另测保留，不混同新跳期；恢复处理它时依原dueSlot所属revision，不把全部backlog重定价（F10/F11）。

### B13 首终态计数与有限结束（UC-S；G＋H）
- Given：四个已留存期次和各自可信证据；When：前三期各有一次合法失败终态，第四期相关TA确认，重复投递所有终态。
- Then：独立oracle `failureTotal=3, successTotal=1, paused=false`，不是三败自动暂停；重复计数增量0（F12）。
- 将第四期改为仅付款成功、accepted、unknown或退款未完成分别重设场景：success仍0且第四期无firstTerminal；所有slot已派发也不能显示“全部投资完成”（F12）。

## 8. 本角色负责收口的未决问题与建议

| 编号 | 仍缺的业务决定 | 本角色建议及交付边界 |
|---|---|---|
| Q1 准入含义 | demo客户/基金映射是否足以进入演示？哪些资格明确不覆盖？ | 我建议明确“受信演示名单”，不展示真实适当性通过。由银行业务owner裁定排除项；不新增法规、评分阈值或假审批。 |
| Q2 撤单/改单 | 是否接受本有界版本只有草稿放弃、没有客户现金撤单/改单？ | 我主张接受该范围并在发送前说明。若否，需业务owner先给可撤阶段、在途竞态、退款条件和失败承诺；不能让研发直接复用补偿命令。 |
| Q3 原意图寿命 | 请求号跨刷新/标签页/会话如何保留？何时允许明确另购？ | 我负责渠道确认路径；建议重试原号、新购另号、未决旧单醒目提醒。保存位置/期限待决，不私加永久浏览器存储或跨ID金额去重。 |
| Q4 原配置寿命 | authorityVersion变化后旧original仍需怎样被验证和服务？ | 我负责解释客户承诺；提交“演示期间配置固定”与“显式版本化核验旧配置”两选项给集成owner裁决，不能悄悄按新账户重映射原单。 |
| Q5 时间与异常承诺 | 哪些等待必须转运营、客户多久能收到更新？ | 我建议先提供按原单查询和责任归属，不报没有来源的T+1、退款小时数或自动重试次数；retry/backoff/deadline仍OPEN（S01:30；S02:127–129）。 |
| Q6 有限定投管理 | 无首tick时暂停如何提示？日程耗尽但仍有在途交易如何命名？恢复backlog如何确认？ | 我负责客户说明与恢复影响清单；保留有限日程，不加cron、无限续期、三败暂停、日历改期或自动合并扣款。 |
| Q7 金额显示/等价 | 用户输入“元”还是minorUnits？不同文字表示是否算同正文？ | 我建议界面复述元金额，运输仍用原精确DTO；文案/格式化须另验。F3是完整original相等，不得擅称任意等值金额串都可幂等重放。 |
| Q8 确认数据承诺 | 是否只展示模拟TA给出的文本，还是要增加真实计价关系的示例？ | 我支持先明确“模拟TA确认数据”；100.00与80.0000/1.2345不能推出费用。若扩充计价，需独立产品决定与oracle，未决前不做NAV/费用承诺。 |

上述Q由本角色向主集成提交取舍，不冒称其他虚拟角色同意。实施前先裁决影响客户承诺的Q1/Q2/Q3/Q4，再分别授权作者、手写实现和独立测试；不要求重开公共业务表达设计。

## 9. 精确来源索引（本次读取字节；不是运行证据）

Git HEAD导航值：`f8ac7ca882335a7c84cff7cbcb5100b6091b864a`。以下SHA-256绑定实际工作树文件，不声称工作树与HEAD全量一致；行号均为物理作者/源码文件行号，不沿结构中的虚拟slice路径新建文件。

| ID | 绝对源文件路径 | SHA-256 |
|---|---|---|
| S01 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/TRUTH.md` | `22ff12d956f30fb46abc5d919255b58f1f1cf3c9be338b4d045e466a1b522520` |
| S02 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/AGENTS.md` | `d06ea3445bd1f2e3230c104fe140fb7379d31dd9af018fc03a069fda7731b26c` |
| S03 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/docs/FUND-PURCHASE-BUSINESS-DELIVERY-20261115.md` | `b02e381b853748507e2ea8c4e987fb6913123b57887a2818facb836e8e566ec4` |
| S04 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/use-cases.yaml` | `531663b9e938256b465d3b302a4d5e6798aacb689cd198a795668764aadb3b5e` |
| S05 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankTrustedAdmission.scala` | `6a861c4f8e6b3920a32136a324506a3b17b0a91a917eefdc48bd332550a4abef` |
| S06 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankCashRequests.scala` | `21cf50e66468caec589e83a20f5fa92806eb2c52913cfc7016df68f460e0b1d9` |
| S07 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankRequestIdentity.scala` | `41857ea44ad3ddd24b75f9d7199f5f5ae152b90e48840918c9b09130dec84c23` |
| S08 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/record-cash-request-source.slice.yaml` | `55119a58a3440d079af5cc647202fef6e7b3951835a6097950dc34c07fdd3252` |
| S09 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/request-fund-purchase-settlement.slice.yaml` | `c3dc1fabc62a3fd622933bf01a66859171b5e834319fe62cae7311dfd7dd3e2b` |
| S10 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/structures/outgoing-funds.structure.yaml` | `825c0141d95f6a02418424aa8e0d43dd30a5bbae607f6deb5a02efde3effa720` |
| S11 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/BankBalanceComputations.scala` | `ceb8afd93202ceb3da389e3e4edc7f612a5512894a9b2af7c55e622874732b3e` |
| S12 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/structures/order-payment.structure.yaml` | `9f094ae69482180f427ca48fefea6ae6fe47400ff158370e15fd3aed55cea015` |
| S13 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/structures/payment-results.structure.yaml` | `bb300b353ab14f030e231263acd584122fd0e75e3ea777ce45fc3f46fa46284a` |
| S14 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/sagas/bank-cash-payment-v1.saga.yaml` | `9df6b256506669f8e0f40900bb37cb77696c9f1a17eaa13f229a054d43b2fb0d` |
| S15 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/record-fund-ta-confirmed.slice.yaml` | `5f06801a987491448c7a79c92c314c00b3f71c90eac2425a679ce23276280793` |
| S16 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/BankTaBridge.scala` | `bf8efecf3f15aca841a6a6ef870de8b1bf7c12269a95c1ce66f2a7e9de1ac7de` |
| S17 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/fund-order/slices/request-fund-purchase-refund.slice.yaml` | `6977766c5484f0c003451f5df93102acd3efd6d3102d5d7c14960f66ed6fdfb8` |
| S18 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/sip/BankSipApplication.scala` | `fafc993a2854fc00da26b3ddf6171e1c60c256e03e552b9ca7463a20d488dbcf` |
| S19 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/trigger-sip-installment.slice.yaml` | `7499c577498e085c8ff8246c5d633ad1c9106df458e219553f5eb9f3000c5419` |
| S20 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/revise-sip-plan.slice.yaml` | `7e1714c020b34d9b9adb8daf93ed91aad9cf953606c6c47c2ad8a8de09d884d8` |
| S21 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/pause-sip-plan.slice.yaml` | `b72efc7ff50d9e545847d7a0c419f7cb7d97437f2a4e580ee61175847f34f6b4` |
| S22 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/resume-sip-plan.slice.yaml` | `ccff6e66ff091535cd9cc92ee98a369616012d7f58643fb17dd00af674c86f10` |
| S23 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/skip-paused-sip-due-slot.slice.yaml` | `9d42742cf36d69b9802b72879c93694012cd2a4da808a554c6411921dd6be019` |
| S24 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/bindings/BankSipTerminalBridge.scala` | `a1cdd34f40425aaa93cf95f86ad2fbaade5893e9d3cbae5263de188576865a6d` |
| S25 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/record-sip-installment-succeeded.slice.yaml` | `3ad7d3e3feed55f65859a03accc077cf49514f95537dfcb3e015182e5fd621e4` |
| S26 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truth/bank-wealth/contexts/bankwealth/aggregates/sip-plan/slices/record-sip-installment-failed.slice.yaml` | `373a09ee4da5648cfaf8b6a84fdb8ba9a3eee77a89c396eff5133830ff5ecc30` |
| S27 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankServiceEndpoints.scala` | `872d814864d587fdf1d487296bb4e160b74e34236fee62a3b2a410eecf1ee5e2` |
| S28 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/integration/BankServiceJson.scala` | `1c6963ad4264eca19c6e0041f7d107ddcefce921ddb5fe7d7c1485254fbf39c7` |
| S29 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/handwritten/scala/example/bankwealth/web/BankBrowserPages.scala` | `fac999de7cce279679612da8d29def2078c6d90f3bfb936c0738f3586aca7ab0` |
| S30 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankSinglePaymentOracleSpec.scala` | `81873a3e8755adacf9a6538065924c4208cb2226dc4c7a5001e094481c6fcc23` |
| S31 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankTaApplicationSpec.scala` | `bdea46506c840bcc079afcdaf06293122ab500034a0fff49986ca29256355c9f` |
| S32 | `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/test/scala/BankRefundApplicationSpec.scala` | `6beead5ecfad21293d77022d754734b27720774f94a653d1d817a29b3a737acf` |
