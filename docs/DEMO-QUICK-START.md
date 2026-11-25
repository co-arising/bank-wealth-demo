# Bank Wealth Local Demo Quick Start Guide / 本地运行快速指南

本指南帮助你在本机通过 **Docker（MongoDB 4.4 + MySQL 8.0）** 快速拉起完整的 `bank-wealth-demo` Play/Akka CQRS 应用，并通过内置浏览器界面或自动化 Smoke 脚本亲手体验四条核心业务线：

1. **现金申购与跨聚合 TCC 付款**（`bank-cash-payment-v1` Saga）
2. **Mock TA 份额确认**（付款成功 ≠ 投资成功，需推进业务时钟等待 TA 确认回执）
3. **TA 拒绝与独立退款**（`bank-independent-refund-v1` 独立退款 Saga，而非撤销已 Commit 付款）
4. **有限定投计划（SIP）**（`bank-sip-dispatch-v1` Pipeline，复用同一套现金规则与业务时钟）

> **教学演示说明**：本 Demo 仅用于本地学习与架构验证，使用固定本地演示凭据和内存/本地 Mock TA 模拟器，不涉及任何真实资金或外部金融机构。

---

## 1. 环境准备 / Prerequisites

| 组件 | 要求 | 说明 |
|---|---|---|
| **Docker** | Docker Desktop / Engine（支持 `docker compose` 或 `docker-compose`） | 拉起隔离的 `mongo:4.4` 与 `mysql:8.0` 容器 |
| **JDK** | **JDK 11**（如 AdoptOpenJDK / Eclipse Temurin 11） | Play 2.8 / Scala 2.13 运行与构建 |
| **sbt** | sbt 1.x | 编译并生成 `stage` 可执行分发包 |
| **Node.js** | **Node ≥ 22.13.0** | 代码生成、一键启动器与内置 Mock TA 子进程 |
| **依赖仓库** | 相邻目录存在配套的 `../metarch-truthsrc` 及已准备的 `.local/truthsrc-runtime-0.3.0/maven` | 提供 `truthsrc` 生成器与 `saga-core` / `monarch-persistence` / `common-core` 依赖 |

> **为什么 MongoDB 必须固定为 4.4？**
> 事件库使用 `akka-persistence-mongo-rxmongo 3.0.8`（ReactiveMongo 1.0.10），依赖 MongoDB 4.4 线协议。[docker-compose.demo.yml](../docker-compose.demo.yml) 已固定使用 `mongo:4.4` 和 `mysql:8.0`，并将端口映射到 `127.0.0.1:19001` 与 `127.0.0.1:19002`，不会与本机默认的 `27017`/`3306` 冲突。

---

## 2. 五步快速启动 / 5-Step Quick Start

以下命令均在 `bank-wealth-demo` 仓库根目录执行：

### Step 1：启动 Docker 数据库容器（MongoDB 4.4 + MySQL 8.0）

```bash
docker compose -f docker-compose.demo.yml up -d
```

等待约 10–15 秒让 MySQL 完成首次初始化，可用以下命令确认两个容器均为 `healthy`：

```bash
docker compose -f docker-compose.demo.yml ps
```

### Step 2：从真源生成 Scala/Play 工程

如果尚未生成或刚拉取最新真源：

```bash
npm run project
```

### Step 3：编译并打包 Play 可执行分发（`sbt stage`）

```bash
(cd generated/current && sbt --batch stage)
```

> 首次打包会编译约 370 个 Scala 源文件并生成 `generated/current/target/universal/stage/bin/root`，耗时约 1 分钟；后续如未改动源码可直接跳过此步，或在启动时传入 `--build`。

### Step 4：（可选）一键运行全链路端到端自检（Smoke Test）

```bash
npm run demo:smoke
```

该命令会自动分配隔离 namespace，拉起 Play 服务，依次验证：
- 浏览器入口 `/bank/v1` 与客户端脚本 `/bank/v1/client-script`；
- 21 项认证/权限/CSRF/Origin/防字段注入负例检查；
- 51 次完整业务流 HTTP 请求（现金申购 + 幂等重放 + 409 冲突 + TA 确认 `80.0000` 份 + 定投创建/暂停/恢复/2 期触发 + 账户账平 `customer=88000` / `collection=12000`），完成后自动退出并清理临时 TA 日志。

### Step 5：启动交互式 Demo 服务

```bash
npm run demo:start
```

启动成功后终端会输出类似信息：

```text
====================================================================
  Bank Wealth Demo is LIVE
====================================================================
  Browser UI : http://127.0.0.1:19000/bank/v1
  TA Scenario: confirmed  (namespace: bankdemo)
  Seed Funds : customer = 100000 minor units (1,000.00 CNY), fundCode = "fund"

  Customer sign-in credentials:
    Bearer token : demo-customer-token
    CSRF token   : demo-customer-csrf

  Operator sign-in credentials (business-clock tick / pending ops):
    Bearer token : demo-operator-token
    CSRF token   : demo-operator-csrf
====================================================================
```

---

## 3. 浏览器演练剧本 / Interactive Browser Walkthrough

用浏览器打开 **`http://127.0.0.1:19000/bank/v1`**（如需同时操作客户和运营，可开两个浏览器标签页分别登录）：

### 演练 A：现金申购 → 支付成功 → 推进业务时钟 → TA 确认份额

1. **客户登录**：在页面选择 `Customer`，填入 `demo-customer-token` 与 `demo-customer-csrf`，点击 **Validate sign-in**。
2. **查看初始余额**：点击 **My account** → **Read current projection**，可见 `available = 100000 CNY`（即 1,000.00 元，金额以最小单位“分”表示）。
3. **发起 100 元基金申购**：点击 **Submit cash request**，填写：
   - `clientRequestId`: `demo-cash-001`
   - `fundCode`: `fund`
   - `minorUnits`: `10000`
   - `currency`: `CNY`
   提交后记下返回的 `payment.fundOrderId`。
4. **观察“付款成功 ≠ 投资成功”**：点击 **Fund order** 查询该 `orderId`，此时你会看到：
   - `paymentStatus`: `succeeded`（TCC 扣款已完成，客户余额变为 `90000`）
   - `taStatus`: `accepted`（Mock TA 已受理，尚未确认份额）
5. **运营推进业务时钟**：切到另一个标签页（或退出后切换）用 `Operator`（`demo-operator-token` / `demo-operator-csrf`）登录，点击 **Manual business-clock tick**，输入 `slot = 1` 提交。
6. **验证 TA 确认**：回到客户页再次查询 **Fund order**，此时 `taStatus` 变为 `confirmed`，`taShares` 显示 `shares: "80.0000", nav: "1.2345"`，`refundStatus: "not-required"`。

### 演练 B：体验 TA 拒绝 → 自动触发独立退款 Saga

1. 在终端按 `Ctrl+C` 停掉当前 Demo 服务；
2. 以 `rejected` TA 场景重启（复用同一个 `bankdemo` 数据，或加 `--namespace bankdemo_refund` 开一个全新空间）：
   ```bash
   node tools/demo-start.mjs --scenario rejected
   ```
3. 客户登录提交一笔新的现金申购（如 `clientRequestId = demo-refund-001`，`minorUnits = 10000`）；
4. 运营推进业务时钟（将 `slot` 推进 1 个 tick，如 `slot = 2`）；
5. 查询该笔 **Fund order**：你会看到 `paymentStatus: "succeeded"`、`taStatus: "rejected"`、`refundStatus: "succeeded"`，且 `refundOperationId` 是一个**独立于原付款 `operationId` 的新退款事务标识**；同时客户余额已完整退回。

### 演练 C：有限定投计划（SIP）

1. 在 `confirmed` 场景下，客户点击 **Create SIP plan**：
   - `clientRequestId`: `demo-sip-001`
   - `fundCode`: `fund`
   - `minorUnits`: `1000`（每期 10.00 元）
   - `currency`: `CNY`
   - `effectiveSlot`: `0`
   - `dueSlots`: `10, 20`
2. 可依次点击 **Pause SIP plan** / **Resume SIP plan** 观察状态变更；
3. 运营依次通过 **Manual business-clock tick** 推进 `slot = 10`、`20`、`21`；
4. 客户查询 **SIP plan** 与 **SIP installments**，可见两期均触发扣款并获得 TA 确认（`successTotal: 2`）。

---

## 4. 常用选项与清理 / Options & Cleanup

查看启动器全部参数：

```bash
node tools/demo-start.mjs --help
```

支持的参数包括：
- `--scenario <name>`：`confirmed`（默认）| `rejected` | `delayed` | `unknown` | `accepted` | `duplicate-identical` | `duplicate-conflicting`
- `--port <port>`：Play HTTP 端口（默认 `19000`）
- `--mongo-port <port>` / `--mysql-port <port>`：数据库端口（默认 `19001` / `19002`）
- `--namespace <name>`：隔离业务命名空间（换一个名字即可在不删库的情况下开新实验）
- `--build`：启动前自动执行 `sbt --batch stage`
- `--smoke`：自动运行端到端验证后退出

**停止容器 / 彻底清空数据：**

```bash
# 仅停止容器（保留数据卷）
docker compose -f docker-compose.demo.yml down

# 停止容器并清空 MongoDB、MySQL 数据卷与本地 Mock TA 日志
docker compose -f docker-compose.demo.yml down -v
rm -rf .local/mock-ta/demo-*
```

---

## 5. 常见问题 / Troubleshooting

- **浏览器打开 `/` 返回 404**：本服务的声明式页面入口为 **`http://127.0.0.1:19000/bank/v1`**（由真源 `bank-service.formal.yaml` 的 `pages.shellPath` 严格限定，未声明路径默认关闭）。
- **端口冲突**：如果 `19000` / `19001` / `19002` 被占用，可调整 `docker-compose.demo.yml` 映射端口并通过 `--port` / `--mongo-port` / `--mysql-port` 指定。
- **MySQL 刚启动时连接失败**：首次 `docker compose up -d` 后 MySQL 8.0 需要 10–15 秒初始化，请等 `docker compose -f docker-compose.demo.yml ps` 显示 `healthy` 再执行 `npm run demo:start`。
- **与正式 Workshop 验收的区别**：本脚本是面向开发者的轻量交互式 Demo；完整的离线归档、沙盒隔离与 24 项崩溃恢复验收请参见 [BANK-WORKSHOP.md](BANK-WORKSHOP.md)。
