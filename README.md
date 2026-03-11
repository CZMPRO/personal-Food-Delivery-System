# personal-Food-Delivery-System (小型外卖系统)

个人练习项目

快速启动说明：

- 安装依赖：

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

- 运行服务：

```bash
python app.py
```

默认服务器在 `http://127.0.0.1:5000/`，页面可浏览餐馆、查看菜单并下单。

新增功能：

- 用户注册/登录：`POST /api/users/register` 与 `POST /api/users/login`，返回 `user_id`。
- 订单持久化：订单存于 `orders.db`（SQLite）。
- 支付模拟：`POST /api/pay`，传 `order_id` 完成支付（更新订单状态为 `paid`）。
- 前端改进：购物车数量调整、总价、登录/注册界面、我的订单历史。

近期业务完善：

- 订单流程调整为：`pending_payment -> paid -> accepted -> preparing -> out_for_delivery -> delivered`，并支持管理员在合法状态下取消订单。
- 下单与评价新增参数校验（用户有效性、评分范围、菜品价格/数量合法性等）。
- 支付接口新增用户归属校验，禁止跨用户支付订单，并限制重复支付。
- 订单新增 `total_amount` 字段，用于用户中心累计消费与后台订单金额展示。

数据库检查脚本：`scripts/inspect_db.py`，用于打印 `orders` 与 `items`。
