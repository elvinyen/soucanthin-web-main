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
AGENT_CODE_SECRET="replace-with-a-separate-long-random-secret"
ADMIN_REVIEW_TOKEN="replace-with-a-long-random-admin-token"
ADMIN_SESSION_SECRET="replace-with-a-long-random-admin-session-secret"
GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
LALAMOVE_API_KEY=""
LALAMOVE_API_SECRET=""
LALAMOVE_API_ENV="sandbox"
VITE_FACEBOOK_URL="https://www.facebook.com/your-page"
VITE_WHATSAPP_URL="https://wa.me/60123456789"
```

`SUPABASE_SERVICE_ROLE_KEY` 只应在服务端 API 使用，不要暴露到前端。
`VITE_` 开头的变量会打包到前端，只适合放公开链接，不要放密钥。
`AGENT_CODE_SECRET` 用于哈希一次性代理码，生产环境应使用独立的高强度随机值。

生产环境建议复制为 `.env.production`。在 VPS 上，以下变量只放在 Node/PM2 后端环境：

- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_ADMIN_IDS`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MOCEAN_API_TOKEN`
- `SESSION_SECRET`
- `AGENT_CODE_SECRET`
- `ADMIN_SESSION_SECRET`
- `ADMIN_REVIEW_TOKEN`
- `GOOGLE_MAPS_API_KEY`
- `LALAMOVE_API_KEY`
- `LALAMOVE_API_SECRET`
- `LALAMOVE_API_ENV`

前端只允许使用 `VITE_FACEBOOK_URL`、`VITE_WHATSAPP_URL` 这类公开变量。

## Supabase 建表

在 Supabase SQL Editor 中执行 [supabase-schema.sql](/Users/Ysongh/Downloads/soucanthin-web-main/supabase-schema.sql)。

订单提交成功后：

- `menu_items` 保存菜品主数据、菜品详细内容、标签、售罄状态和加价选项配置。
- `orders` 保存订单主记录、客户信息、金额、支付状态、审核状态和通知状态。
- `order_items` 保存每个菜品明细、所选加价选项和单品备注。
- `payment-receipts` Supabase Storage bucket 保存 TNG 付款截图。
- Telegram 通知失败时，订单仍会成功返回，`orders.notification_status` 会记录为 `failed`。

## 吉隆坡配送与超范围审批

- 20km 内由服务端报价。后台未启用 Lalamove、密钥缺失或接口失败时，自动使用 RM6–RM30 的备用阶梯价。
- 启用 Lalamove 后，顾客配送费按实时报价加 15% 并向上取整；报价默认锁定 30 分钟。密钥只放在服务端环境变量中。
- 超过 20km 不会自动生成申请，也不会显示付款或 TNG 截图区域。顾客先联系 WhatsApp，再登录并主动点击提交申请。
- 客服、经理、管理员和老板在“配送工作台 → 超范围申请”审批；批准时必须填写配送费、配送方式和预计时间，拒绝时必须填写原因。
- 待处理申请默认 2 小时过期，批准后 30 分钟内必须下单。地址、门店、商品、数量或选项变化后，原审批不可使用。
- 系统当前只调用 Lalamove 报价接口，不会自动叫车。厨房完成后仍由员工人工叫车，并在现有配送工作台填写配送单号和成本。

首次上线建议保持后台的“启用 Lalamove 实时报价”关闭，确认备用阶梯价流程正常后，再配置 Sandbox 密钥进行验证。生产密钥切换步骤：

1. 将 `LALAMOVE_API_ENV` 改为 `production`，配置生产 API Key 与 Secret。
2. 重启 API 服务。
3. 在后台配送设置中开启 Lalamove 实时报价。
4. 观察报价降级原因、顾客配送费与实际叫车成本差额；异常时可直接在后台关闭实时报价，系统立即回退阶梯价。

## 支付流程

- 现金：订单入库后立刻通知员工，付款状态为 `pay_at_counter`。
- TNG：用户看到 `TNG_ACCOUNT_NAME` / `TNG_ACCOUNT_NUMBER`，转账后上传截图；订单状态为 `pending_review`，员工在 Telegram 里查看截图并人工审核。
- Stripe：前端调用 `/api/stripe-checkout` 创建沙盒 Checkout Session 并跳转 Stripe；只有 `/api/stripe-webhook` 收到 `checkout.session.completed` 后，订单才会标记为 `paid` 并通知员工。

## Telegram 管理员

- `TELEGRAM_ADMIN_IDS` 是初始管理员白名单，至少保留一个老板/负责人 Telegram 数字 ID。
- 其他人先私聊订单机器人并发送 `/start`，系统会把他登记到 `telegram_users` 表。
- 已有管理员在机器人里发送 `/admin_users`，可以从已登记用户列表里点击按钮设置或取消订单管理员。
- 被设为管理员后，可以在订单通知按钮里确认订单、开始配送、标记送达、完成或取消订单。

## 后台管理系统

后台入口为：

```text
http://localhost:3000/admin
```

后台员工统一使用三种角色：

- `admin`：管理员，拥有账号、资金、财务、佣金、安全设置和全部业务权限。
- `customer_service`：运营助理，负责订单、顾客、菜单、优惠券、代理申请、配送审批与日常设置；可由管理员授予“所有门店”或“指定门店”范围，但不能管理后台账号、钱包调账、佣金提现或财务冲销。
- `kitchen`：厨房工人，登录后固定进入 `/admin/kitchen` 独立厨房看板，只能处理所属门店的开始制作、完成制作和缺货上报。

厨房账号必须分配一个所属门店；运营助理可以查看所有门店，也可以限制到一个指定门店。订单、厨房、配送及超范围审批接口会在服务端校验门店，不能仅依靠前端菜单隐藏。

三个角色登录后都可从账号区或厨房设置菜单进入“修改密码”。修改成功会撤销该账号的其他登录会话，并为当前设备签发新会话。

管理员可在 `/admin/audit-logs` 查看统一操作日志。登录、审核、设置以及所有后台人工写操作都会记录操作者、当时角色、门店、请求结果、IP 和设备信息；密码、令牌、验证码、图片数据及个人敏感字段会被过滤。日志表只允许新增和查询，不允许后台更新或删除。

首次打开时，如果数据库还没有管理员账号，页面会显示“创建首个管理员”。输入：

- 账号：管理员登录名，例如 `admin`
- 显示名称：后台显示用名称
- 密码：至少 8 位
- Setup Token：环境变量 `ADMIN_REVIEW_TOKEN`

创建成功后，后续登录只需要管理员账号和密码。后台登录状态通过 HttpOnly session cookie 保存，服务端会校验 `admin_sessions`，前端不会接触 `SUPABASE_SERVICE_ROLE_KEY`。

菜单管理支持上传菜品图片。后台会先在浏览器端把原图压缩转换为 WebP，再通过服务端上传到 Supabase Storage 的 `menu-items` bucket。文件名固定为：

```text
{item_code}.webp
```

原图最大 8MB，转换后的 WebP 最大 1.5MB。

## 代理系统

- 登录会员可在“个人中心 → 代理合作”提交申请，并通过 WhatsApp 携带申请编号联系客服。
- 代理申请、审核状态、资料补充和一次性代理码激活统一保留在会员个人中心；激活后通过“进入代理中心”打开 `/agent`。
- `/agent` 是独立代理工作台，继续使用会员手机号 OTP 和同域 HttpOnly Session，提供推广工具、推广订单、佣金明细、提现记录与账户信息。
- 未登录用户在 `/agent` 使用申请时绑定的手机号登录；非代理或未激活用户会被引导返回个人中心，暂停或终止的代理只能查看历史数据。
- 后台 `/admin/agents` 支持申请审核、一次性代理码、手机号批量注册、代理启停、佣金规则、佣金调账和提现审核。
- 一次性代理码绑定申请人与手机号，72 小时有效，连续错误 5 次后锁定，数据库只保存 HMAC 哈希。
- 推广链接使用 `?ref=推广码`；推荐关系在被推荐用户登录后绑定，禁止自我推荐且不会覆盖已有归属。
- 佣金按商品小计扣除优惠后的金额计算；订单完成后转为可提现，订单取消则自动作废。
- 部署前必须执行最新版 `supabase-schema.sql`，并配置 `AGENT_CODE_SECRET`、`SITE_URL` 和 `VITE_WHATSAPP_URL`。

## 会员与钱包

- Header 右侧用户图标会打开手机号 OTP 登录；OTP 通过 Mocean Verify API 发送和校验。
- OTP 请求会在服务端保存为一次性 challenge，并绑定手机号、用途和修改手机号时的当前账号；同一手机号和客户端均有小时/每日限流。
- 会员 Session 使用 HttpOnly Cookie，有效期 30 天，每个账号最多保留 5 个活动 Session。
- 登录成功后可进入个人中心查看资料、钱包、订单、地址、优惠券和设置。
- 下单仍支持免登录；如果用户已登录，订单会自动关联到个人中心。
- 钱包充值支持 Stripe 自动入账，以及 TNG 截图提交后由 Telegram 审核链接通过或拒绝。
- 新数据库执行最新版 `supabase-schema.sql`；已有数据库必须先执行 `supabase-auth-security.sql`，再部署新版 API。脚本会新增 `otp_challenges`，并限制会员、Session、钱包和地址表只能由服务端 `service_role` 访问。

本地测试 Stripe webhook：

```bash
stripe listen --forward-to localhost:3001/api/stripe-webhook
```

把 Stripe CLI 输出的 `whsec_...` 填到 `STRIPE_WEBHOOK_SECRET`。

## 验证命令

```bash
npm test
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
