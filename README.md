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

## VPS 部署

项目现在支持在 VPS 上以一个 Express 服务运行：

- `dist/` 提供 React 前端静态文件。
- `server/index.mjs` 提供真实 `/api/*` 路由、Stripe webhook、健康检查和前端路由回退。
- PM2 负责 Node 进程常驻。
- Nginx 负责 HTTPS、直接托管前端静态文件，并把 `/api/*` 反向代理到 Express 服务。

### 1. 服务器准备

以 Ubuntu 为例，安装 Node.js 20+、Nginx、PM2 和常用工具：

```bash
sudo apt update
sudo apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
npm -v
pm2 -v
```

### 2. 上传代码并安装依赖

```bash
sudo mkdir -p /var/www/soucanthin-web
sudo chown -R $USER:$USER /var/www/soucanthin-web
cd /var/www/soucanthin-web
git clone <your-repo-url> .
npm ci
```

如果不是用 Git，也可以把项目文件上传到 `/var/www/soucanthin-web` 后执行 `npm ci`。

### 3. 配置环境变量

在服务器项目目录创建 `.env`：

```bash
cd /var/www/soucanthin-web
cp .env.example .env
nano .env
```

生产环境至少要把这些值换成真实配置：

```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
TELEGRAM_TOKEN="your-telegram-bot-token"
TELEGRAM_CHAT_ID="your-telegram-chat-id"
TNG_ACCOUNT_NAME="Soup Can Thin"
TNG_ACCOUNT_NUMBER="0123456789"
STRIPE_SECRET_KEY="sk_live_or_test_key"
STRIPE_WEBHOOK_SECRET="whsec_your-webhook-secret"
SITE_URL="https://your-domain.com"
MOCEAN_API_TOKEN="your-mocean-api-token"
MOCEAN_BRAND="SoupCanThin"
MOCEAN_SENDER_ID=""
SESSION_SECRET="replace-with-a-long-random-secret"
ADMIN_REVIEW_TOKEN="replace-with-a-long-random-admin-token"
VITE_FACEBOOK_URL="https://www.facebook.com/your-page"
VITE_WHATSAPP_URL="https://wa.me/60123456789"
```

生成随机密钥可以用：

```bash
openssl rand -base64 48
```

### 4. 初始化 Supabase

在 Supabase SQL Editor 执行：

```sql
-- 粘贴并执行 supabase-schema.sql 的全部内容
```

确认 `payment-receipts` 和 `menu-items` storage bucket 已创建。菜单图片 URL 如果不是当前项目的 Supabase Storage，需要在 `menu_items.image_url` 中更新。

### 5. 构建项目

```bash
cd /var/www/soucanthin-web
npm run build
```

构建完成后会生成：

- `dist/`：前端静态资源。
- `server/index.mjs`：VPS 生产 Express 服务。

### 6. 使用 PM2 常驻运行

项目已提供 `ecosystem.config.cjs`。第一次启动：

```bash
cd /var/www/soucanthin-web
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`pm2 startup` 会输出一行需要 `sudo` 执行的命令，复制执行即可。之后常用命令：

```bash
pm2 status
pm2 logs soucanthin-web
pm2 restart soucanthin-web
```

### 7. 配置 Nginx 静态文件和反向代理

创建 Nginx 配置：

```bash
sudo nano /etc/nginx/sites-available/soucanthin-web
```

写入并替换域名：

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/soucanthin-web/dist;
    index index.html;
    client_max_body_size 8m;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /healthz {
        proxy_pass http://127.0.0.1:3000/healthz;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/soucanthin-web /etc/nginx/sites-enabled/soucanthin-web
sudo nginx -t
sudo systemctl reload nginx
```

### 8. 配置 HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

完成后，把 `.env` 里的 `SITE_URL` 确认成 HTTPS 域名：

```bash
SITE_URL="https://your-domain.com"
```

修改 `.env` 后重启服务：

```bash
pm2 restart soucanthin-web
```

### 9. 配置 Stripe Webhook

在 Stripe Dashboard 添加 webhook endpoint：

```text
https://your-domain.com/api/stripe-webhook
```

监听事件至少包含：

```text
checkout.session.completed
```

把 Stripe 生成的 webhook signing secret 填到：

```bash
STRIPE_WEBHOOK_SECRET="whsec_..."
```

然后重启：

```bash
pm2 restart soucanthin-web
```

### 10. 部署后检查

```bash
curl https://your-domain.com/healthz
curl -I https://your-domain.com/
pm2 logs soucanthin-web --lines 100
```

浏览器打开：

```text
https://your-domain.com/?table=12
```

重点测试：

- 菜单是否能加载。
- 现金下单是否能写入 Supabase 并通知 Telegram。
- TNG 截图上传和审核链接是否正常。
- Stripe Checkout 是否能跳转，付款后 webhook 是否把订单标记为 paid。
- OTP 登录、钱包充值、地址管理是否正常。

## 平台部署提示

项目仍保留 `api/*.ts` handler。如果部署到 Vercel，也可以继续使用平台的 Serverless Functions；如果部署到 VPS，使用上面的 Express 服务入口。
