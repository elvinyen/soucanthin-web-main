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

如果要单独测试生产用 Express API：

```bash
npm run dev:api
```

默认 API 地址为 `http://127.0.0.1:3001`。

## 环境变量

复制 `.env.example` 为 `.env.local`，并填入以下配置：

```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
TELEGRAM_TOKEN="your-telegram-bot-token"
TELEGRAM_CHAT_ID="your-telegram-chat-id"
TELEGRAM_ADMIN_IDS="123456789,987654321"
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

生产环境建议复制为 `.env.production`。在 VPS 上，以下变量只放在 Node/PM2 后端环境：

- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_ADMIN_IDS`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MOCEAN_API_TOKEN`
- `SESSION_SECRET`
- `ADMIN_REVIEW_TOKEN`

前端只允许使用 `VITE_FACEBOOK_URL`、`VITE_WHATSAPP_URL` 这类公开变量。

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
stripe listen --forward-to localhost:3001/api/stripe-webhook
```

把 Stripe CLI 输出的 `whsec_...` 填到 `STRIPE_WEBHOOK_SECRET`。

## 验证命令

```bash
npm run lint
npm run build
```

## 部署提示

项目现在支持 VPS 部署：Vite 构建静态前端，Express 提供真实 `/api/*` 路由，Nginx 托管 `dist/` 并反向代理 API 到 PM2。

### 1. VPS 安装基础组件

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. 构建并启动后端

```bash
npm ci
cp .env.example .env.production
nano .env.production
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`ecosystem.config.cjs` 默认让 API 只监听 `127.0.0.1:3001`，公网入口交给 Nginx。

生产环境必须把 `SITE_URL` 改成正式域名，例如：

```bash
SITE_URL="https://your-domain.com"
```

### 3. Nginx 配置

把下面配置保存到 `/etc/nginx/sites-available/soucanthin`，并把 `server_name` 和 `root` 改成你的真实域名与项目路径。

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/soucanthin-web-main/dist;
    index index.html;

    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/soucanthin /etc/nginx/sites-enabled/soucanthin
sudo nginx -t
sudo systemctl reload nginx
```

### 4. HTTPS

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

证书签发后确认：

- `https://your-domain.com/` 能返回前端页面。
- `https://your-domain.com/api/health` 返回 `{ "success": true, "status": "ok" }`。
- `https://your-domain.com/api/menu` 能通过 Nginx 代理到 PM2 后端。

### 5. 常用 PM2 命令

```bash
pm2 status
pm2 logs soucanthin-api
pm2 restart soucanthin-api
```

### 6. 更新代码后vps操作
```bash
cd /var/www/soucanthin-web-main
git pull
npm ci
npm run build
pm2 restart soucanthin-api
```
