# 深夜食汤移动点餐网站

这是一个移动端优先的餐饮点餐网站，支持扫码带桌号进入菜单、购物车结算、订单写入 Supabase，并根据支付方式发送员工可读的 Telegram 新订单通知。

## 本地运行

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

默认开发地址为 `http://localhost:3000`。带桌号测试可访问：

```text
http://localhost:3000/?table=12
```

## 环境变量

复制 `.env.example` 为 `.env.local`，并填入以下配置：

```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
TELEGRAM_TOKEN="your-telegram-bot-token"
TELEGRAM_CHAT_ID="your-telegram-chat-id"
TNG_ACCOUNT_NAME="Soup Can Thin"
TNG_ACCOUNT_NUMBER="0123456789"
STRIPE_SECRET_KEY="sk_test_your-stripe-secret-key"
STRIPE_WEBHOOK_SECRET="whsec_your-webhook-secret"
SITE_URL="http://localhost:3000"
MOCEAN_API_TOKEN="your-mocean-api-token"
MOCEAN_BRAND="SoupCanThin"
MOCEAN_SENDER_ID=""
SESSION_SECRET="replace-with-a-long-random-secret"
ADMIN_REVIEW_TOKEN="replace-with-a-long-random-admin-token"
VITE_FACEBOOK_URL="https://www.facebook.com/your-page"
VITE_WHATSAPP_URL="https://wa.me/60123456789"
```

`SUPABASE_SERVICE_ROLE_KEY` 只应在服务端 API 使用，不要暴露到前端。
`VITE_` 开头的变量会打包到前端，只适合放公开链接，不要放密钥。

## Supabase 建表

在 Supabase SQL Editor 中执行 [supabase-schema.sql](/Users/Ysongh/Downloads/soucanthin-web-main/supabase-schema.sql)。

订单提交成功后：

- `menu_items` 保存菜品主数据、菜品详细内容、标签、售罄状态和加价选项配置。
- `orders` 保存订单主记录、客户信息、金额、支付状态、审核状态和通知状态。
- `order_items` 保存每个菜品明细、所选加价选项和单品备注。
- `payment-receipts` Supabase Storage bucket 保存 TNG 付款截图。
- Telegram 通知失败时，订单仍会成功返回，`orders.notification_status` 会记录为 `failed`。

## 支付流程

- 现金：订单入库后立刻通知员工，付款状态为 `pay_at_counter`。
- TNG：用户看到 `TNG_ACCOUNT_NAME` / `TNG_ACCOUNT_NUMBER`，转账后上传截图；订单状态为 `pending_review`，员工在 Telegram 里查看截图并人工审核。
- Stripe：前端调用 `/api/stripe-checkout` 创建沙盒 Checkout Session 并跳转 Stripe；只有 `/api/stripe-webhook` 收到 `checkout.session.completed` 后，订单才会标记为 `paid` 并通知员工。

## 会员与钱包

- Header 右侧用户图标会打开手机号 OTP 登录；OTP 通过 Mocean Verify API 发送和校验。
- 登录成功后可进入个人中心查看资料、钱包、订单、地址、优惠券和设置。
- 下单仍支持免登录；如果用户已登录，订单会自动关联到个人中心。
- 钱包充值支持 Stripe 自动入账，以及 TNG 截图提交后由 Telegram 审核链接通过或拒绝。
- 执行 `supabase-schema.sql` 后会新增 `users`、`user_sessions`、`wallets`、`wallet_transactions`、`user_addresses`、`coupons`、`user_coupons` 以及钱包充值入账函数。

本地测试 Stripe webhook：

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

把 Stripe CLI 输出的 `whsec_...` 填到 `STRIPE_WEBHOOK_SECRET`。

## 验证命令

```bash
npm run lint
npm run build
```

## 部署提示

项目保留 `api/order.ts` 作为服务端接口，适合部署到支持 `/api` Serverless Functions 的平台。部署时请在平台环境变量中配置 Supabase 和 Telegram 凭据。
