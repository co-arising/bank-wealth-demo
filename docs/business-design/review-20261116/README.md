# 2026-11-16 模拟业务设计入口

**先读 [SYNTHESIS.md](SYNTHESIS.md)**：主集成已吸收交叉挑战，修正原稿中退款unknown余额、暂停分类边界与TA桥接错误层级等问题，并列出业务方案、具体失败路径、独立预期和有限未决项。

此目录是模拟设计，不是新作者树、运行输入或现实机构批准；没有生成/编译/测试/业务执行，没有修改现行政策、固定oracle或生产实现。

| 材料 | 状态和用途 |
|---|---|
| [bank-product-channel.md](bank-product-channel.md) | 独立银行/客户渠道原稿；F11及B09须以综合稿修正为准 |
| [fund-company-ta.md](fund-company-ta.md) | 独立TA/产品原稿；K12的桥/聚合边界、退款失败及absence恢复案例在综合稿补充 |
| [payment-operations.md](payment-operations.md) | 独立账务运营原稿；可信回执、首次退款前失联与晚到确认在综合稿补充 |
| [architecture-delivery.md](architecture-delivery.md) | 独立架构/研发/验收原稿；运营发现与SIP贯通场景在综合稿补充 |
| [cross-review-results.json](cross-review-results.json) | 四组原始交叉挑战及12条问题；保留原文，不冒充执行回执 |
| [sources-index.json](sources-index.json) | 63份准确源码/作者/固定测试/模拟器副本的SHA与来源身份 |

原稿不覆写，以保留独立观点和审阅所针对的准确文字；最终建议及修正以综合稿为准。执行性规则仍只来自根项目配置选定的当前作者树与具名技术绑定；本目录没有成为第二当前真源。

生成器内容对齐入口：[codegen-parity](../../../../metarch-truthsrc/docs/codegen-parity/README.md)。业务目标原始记录：[FUND-PURCHASE-BUSINESS-DELIVERY-20261115.md](../../FUND-PURCHASE-BUSINESS-DELIVERY-20261115.md)。
