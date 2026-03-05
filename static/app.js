const api = {
  restaurants: '/api/restaurants',
  menu: (id) => `/api/restaurants/${id}/menu`,
  orders: '/api/orders',
  order: (id) => `/api/orders/${id}`,
  pay: '/api/pay',
  userOrders: (uid) => `/api/users/${uid}/orders`
}

// State management
let state = {
  currentUser: JSON.parse(localStorage.getItem('user')) || null,
  restaurants: [],
  currentMenu: [],
  cart: [],
  currentRestaurant: null,
  view: 'auth' // auth, home, menu, history
};

// Selectors
const el = (id) => document.getElementById(id);
const qs = (selector) => document.querySelector(selector);

// Initialization
function init() {
  updateUIState();
  bindEvents();
  if (state.currentUser) {
    loadRestaurants();
  }
}

function updateUIState() {
  // Toggle between Auth, Home, Menu, and History views
  if (!state.currentUser) {
    el('authView').style.display = 'block';
    el('mainView').style.display = 'none';
    el('userProfile').style.display = 'none';
  } else {
    el('authView').style.display = 'none';
    el('mainView').style.display = 'block';
    el('userProfile').style.display = 'flex';
    el('userName').textContent = state.currentUser.username;

    // Admin button visibility
    el('adminPanelBtn').style.display = state.currentUser.is_admin ? 'inline-block' : 'none';

    // View sub-toggles
    el('restaurantView').style.display = state.view === 'home' ? 'block' : 'none';
    el('menuView').style.display = state.view === 'menu' ? 'block' : 'none';
    el('userCenterView').style.display = state.view === 'profile' ? 'block' : 'none';
    el('adminView').style.display = state.view === 'admin' ? 'block' : 'none';
    el('userHistoryView').style.display = state.view === 'history' ? 'block' : 'none';
  }
  renderCart();
}

function bindEvents() {
  el('login').onclick = handleLogin;
  el('register').onclick = handleRegister;
  el('logout').onclick = handleLogout;
  el('userCenterBtn').onclick = showUserCenter;
  el('adminPanelBtn').onclick = showAdminDashboard;
  el('welcomeMsg').onclick = showUserCenter;
  el('logoBtn').onclick = () => { state.view = 'home'; updateUIState(); };
  el('backToRestaurants').onclick = () => { state.view = 'home'; updateUIState(); };
  el('backToHome').onclick = () => { state.view = 'home'; updateUIState(); };
  el('placeOrder').onclick = handlePlaceOrder;

  // Sorting
  el('sortRestaurants').onchange = () => renderRestaurants(el('restaurantSearch').value.toLowerCase());

  // Tabs in Menu View
  el('tabMenu').onclick = () => {
    el('tabMenu').style.color = 'var(--text-main)';
    el('tabMenu').style.borderBottom = '2px solid var(--primary)';
    el('tabReviews').style.color = '#888';
    el('tabReviews').style.borderBottom = 'none';
    el('menuItems').style.display = 'grid';
    el('reviewSection').style.display = 'none';
  };
  el('tabReviews').onclick = async () => {
    el('tabReviews').style.color = 'var(--text-main)';
    el('tabReviews').style.borderBottom = '2px solid var(--primary)';
    el('tabMenu').style.color = '#888';
    el('tabMenu').style.borderBottom = 'none';
    el('menuItems').style.display = 'none';
    el('reviewSection').style.display = 'block';
    loadReviews();
  };

  el('submitReviewBtn').onclick = handleReviewSubmit;

  // Search and Filter
  el('restaurantSearch').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    renderRestaurants(term);
  };

  document.querySelectorAll('.category-tag').forEach(tag => {
    tag.onclick = () => {
      document.querySelectorAll('.category-tag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      renderRestaurants('', tag.textContent === '全部' ? '' : tag.textContent);
    };
  });

  // Phone Editing Logic
  el('editPhoneBtn').onclick = () => {
    el('phoneEditArea').style.display = 'flex';
    el('editPhoneBtn').style.display = 'none';
  };
  el('cancelPhoneBtn').onclick = () => {
    el('phoneEditArea').style.display = 'none';
    el('editPhoneBtn').style.display = 'inline-block';
  };
  el('savePhoneBtn').onclick = handleUpdatePhone;
}

async function handleUpdatePhone() {
  const newPhone = el('newPhoneInput').value;
  if (!newPhone) return alert('请输入手机号');

  const res = await fetch('/api/users/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: state.currentUser.user_id, phone: newPhone })
  });
  const data = await res.json();
  if (data.status === 'success') {
    state.currentUser.phone = newPhone;
    localStorage.setItem('user', JSON.stringify(state.currentUser));
    el('profilePhone').textContent = newPhone;
    el('phoneEditArea').style.display = 'none';
    el('editPhoneBtn').style.display = 'inline-block';
    alert('手机号绑定成功');
  } else {
    alert('更新失败');
  }
}

// Functions
async function loadRestaurants() {
  const res = await fetch(api.restaurants);
  const data = await res.json();
  state.restaurants = data;
  state.view = 'home';
  renderRestaurants();
  updateUIState();
}

function renderRestaurants(searchTerm = '', category = '') {
  const container = el('restaurants');
  const sortBy = el('sortRestaurants').value;

  let filtered = state.restaurants.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm) || r.cate.toLowerCase().includes(searchTerm);
    const matchesCategory = !category || r.cate === category;
    return matchesSearch && matchesCategory;
  });

  // Apply Sorting
  if (sortBy === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  } else if (sortBy === 'distance') {
    filtered.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#888;">没有找到相关餐厅</div>';
    return;
  }

  container.innerHTML = filtered.map(r => `
    <div class="card animate" onclick="loadMenu(${r.id}, '${r.name}')">
      <div class="badge">${r.badge}</div>
      <img src="/static/images/banner.png" class="card-img" alt="${r.name}">
      <div class="card-body">
        <h3>${r.name}</h3>
        <div class="restaurant-info">
          <span>${r.cate}</span>
          <span><span class="rating">★ ${r.rating}</span> • ${r.distance}</span>
        </div>
      </div>
    </div>
  `).join('');
}

async function loadMenu(rid, rname) {
  const res = await fetch(api.menu(rid));
  const items = await res.json();
  state.currentMenu = items;
  state.currentRestaurant = { id: rid, name: rname };
  state.view = 'menu';
  el('currentRestaurantName').textContent = rname;
  renderMenu();
  updateUIState();
}

function renderMenu() {
  const container = el('menuItems');
  container.innerHTML = state.currentMenu.map((item, idx) => `
    <div class="card animate" style="animation-delay: ${idx * 0.1}s">
      <img src="/static/images/${item.image || 'dish_plain.png'}" class="card-img" alt="${item.name}">
      <div class="card-body">
        <div style="display:flex; justify-content:space-between; align-items:flex-start">
          <h3>${item.name}</h3>
          ${item.label ? `<span class="dish-label">${item.label}</span>` : ''}
        </div>
        <p class="dish-desc">${item.desc || '美味佳肴，值得一尝'}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
          <span class="card-price">¥ ${item.price}</span>
          <button class="btn btn-primary" style="padding: 8px 15px; border-radius:10px" onclick="event.stopPropagation(); addToCart(${JSON.stringify(item).replace(/"/g, '&quot;')})">加入购物车</button>
        </div>
      </div>
    </div>
  `).join('');
}

function addToCart(item) {
  const existing = state.cart.find(c => c.id === item.id);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({ ...item, qty: 1 });
  }
  renderCart();
}

function renderCart() {
  const container = el('cartItems');
  const totalEl = el('totalPrice');
  const placeOrderBtn = el('placeOrder');

  if (state.cart.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#888; padding: 20px 0;">购物车是空的</div>';
    totalEl.textContent = '0';
    placeOrderBtn.disabled = true;
    return;
  }

  let total = 0;
  container.innerHTML = state.cart.map((item, idx) => {
    total += item.price * item.qty;
    return `
      <div class="cart-item">
        <div>
          <div style="font-weight:600">${item.name}</div>
          <div style="font-size:0.8rem; color:#888">¥ ${item.price}</div>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateQty(${item.id}, -1)">-</button>
          <span>${item.qty}</span>
          <button class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  totalEl.textContent = total;
  placeOrderBtn.disabled = false;
}

function updateQty(id, delta) {
  const item = state.cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    state.cart = state.cart.filter(c => c.id !== id);
  }
  renderCart();
}

async function handlePlaceOrder() {
  const btn = el('placeOrder');
  const resContainer = el('orderResultContainer');
  btn.disabled = true;
  btn.textContent = '下单中...';

  const payload = {
    customer: {
      name: state.currentUser.username,
      phone: state.currentUser.phone
    },
    items: state.cart,
    user_id: state.currentUser.user_id
  };

  try {
    const res = await fetch(api.orders, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.order_id) {
      state.cart = [];
      renderCart();
      resContainer.style.display = 'block';
      resContainer.innerHTML = `
        <div style="padding:15px; border-radius:10px; background:#f0fff4; border:1px solid #c6f6d5; text-align:center">
          <div style="font-weight:800; color:#22543d">下单成功!</div>
          <div style="font-size:0.9rem; margin:10px 0">订单号 #${result.order_id}</div>
          <button class="btn btn-primary" style="width:100%" onclick="payOrder(${result.order_id})">立即支付</button>
        </div>
      `;
    }
  } catch (e) {
    alert('下单失败');
  } finally {
    btn.textContent = '确认下单';
  }
}

async function payOrder(oid) {
  const resContainer = el('orderResultContainer');
  const res = await fetch(api.pay, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: oid })
  });
  const data = await res.json();
  if (data.status === 'paid') {
    resContainer.innerHTML = `
      <div style="padding:15px; border-radius:10px; background:#ebf8ff; border:1px solid #bee3f8; text-align:center">
        <div style="font-weight:800; color:#2c5282">支付已完成</div>
        <div id="pollingStatus" style="font-size:0.9rem; margin-top:10px">状态追踪中...</div>
      </div>
    `;
    pollStatus(oid);
  }
}

function pollStatus(oid) {
  const statusEl = el('pollingStatus');
  const interval = setInterval(async () => {
    const res = await fetch(api.order(oid));
    const data = await res.json();
    const statusMap = {
      'paid': '等待商家接单',
      'accepted': '商家已接单',
      'preparing': '厨师正在疯狂备餐中...',
      'out_for_delivery': '骑手正在飞奔向您...',
      'delivered': '美味已达，请享用!'
    };
    statusEl.textContent = statusMap[data.status] || data.status;
    if (data.status === 'delivered') {
      clearInterval(interval);
      setTimeout(() => { el('orderResultContainer').style.display = 'none'; }, 5000);
    }
  }, 2000);
}

// History
async function showHistory() {
  state.view = 'history';
  updateUIState();
  const res = await fetch(api.userOrders(state.currentUser.user_id));
  const data = await res.json();
  const container = el('historyTable');
  if (data.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:#888">暂无订单记录</div>';
    return;
  }
  container.innerHTML = data.map(o => `
    <div class="order-row">
      <div>
        <div style="font-weight:800">订单 #${o.id}</div>
        <div style="font-size:0.8rem; color:#888">${new Date(o.created_at * 1000).toLocaleString()}</div>
      </div>
      <div>
        <span class="status-badge status-${o.status}">${o.status}</span>
      </div>
    </div>
  `).join('');
}

// Auth Handlers
async function handleLogin() {
  const u = el('username').value;
  const p = el('password').value;
  if (!u || !p) return alert('请填写用户名和密码');

  const res = await fetch('/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p })
  });
  const data = await res.json();
  if (data.user_id) {
    state.currentUser = data;
    localStorage.setItem('user', JSON.stringify(data));
    state.view = 'home';
    loadRestaurants();
  } else {
    alert(data.error || '登录失败');
  }
}

async function handleRegister() {
  const u = el('username').value;
  const p = el('password').value;
  const ph = el('phone').value;
  if (!u || !p) return alert('请填写用户名、密码');

  console.log("Attempting registration for:", u);
  try {
    const res = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p, phone: ph })
    });
    const data = await res.json();
    if (data.user_id) {
      alert('注册成功！正在为您登录...');
      // 自动登录
      state.currentUser = { user_id: data.user_id, username: data.username, phone: ph };
      localStorage.setItem('user', JSON.stringify(state.currentUser));
      state.view = 'home';
      loadRestaurants();
    } else {
      alert('注册失败: ' + (data.error || '未知错误'));
    }
  } catch (e) {
    console.error("Registration error:", e);
    alert('网络错误，请稍后再试');
  }
}

function handleLogout() {
  state.currentUser = null;
  localStorage.removeItem('user');
  state.view = 'auth';
  updateUIState();
}

async function showUserCenter() {
  state.view = 'profile';
  updateUIState();

  el('profileName').textContent = state.currentUser.username;
  el('profilePhone').textContent = state.currentUser.phone || '未绑定手机';
  el('userAvatar').textContent = state.currentUser.username[0].toUpperCase();

  const res = await fetch(api.userOrders(state.currentUser.user_id));
  const orders = await res.json();

  // Calculate simple stats
  el('totalOrdersCount').textContent = orders.length;

  // To get total spent, we'd ideally need an API or fetch each order's items.
  // For now, let's keep it simple or mock it based on orders.
  el('totalSpent').textContent = `¥ -`;

  const container = el('personalHistoryTable');
  if (orders.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:#888">暂无订单记录</div>';
    return;
  }

  container.innerHTML = orders.map(o => `
    <div class="order-row">
      <div>
        <div style="font-weight:800">订单 #${o.id}</div>
        <div style="font-size:0.8rem; color:#888">${new Date(o.created_at * 1000).toLocaleString()}</div>
      </div>
      <div>
        <span class="status-badge status-${o.status}">${o.status}</span>
      </div>
    </div>
  `).join('');
}

async function showAdminDashboard() {
  state.view = 'admin';
  updateUIState();

  const res = await fetch(`/api/admin/dashboard?user_id=${state.currentUser.user_id}`);
  const data = await res.json();

  if (data.error) {
    alert('权限不足');
    state.view = 'home';
    updateUIState();
    return;
  }

  // Render Users
  el('adminUsersList').innerHTML = data.users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${u.username}</td>
      <td>${u.phone || '-'}</td>
      <td><span class="admin-badge ${u.is_admin ? 'role-admin' : ''}">${u.is_admin ? '管理员' : '普通用户'}</span></td>
    </tr>
  `).join('');

  // Render Orders
  el('adminOrdersList').innerHTML = data.orders.map(o => `
    <tr>
      <td>#${o.id}</td>
      <td>${o.customer_name}</td>
      <td>${o.customer_phone}</td>
      <td>¥ ${o.customer_phone.includes('138') ? '?' : '-'}</td> 
      <td><span class="status-badge status-${o.status}">${o.status}</span></td>
      <td>
        <select onchange="updateOrderStatus(${o.id}, this.value)" style="padding:4px; border-radius:4px; font-size:0.75rem">
          <option value="">更改状态...</option>
          <option value="accepted">接受订单</option>
          <option value="preparing">正在制作</option>
          <option value="out_for_delivery">配送中</option>
          <option value="delivered">已送达</option>
        </select>
      </td>
    </tr>
  `).join('');
}

async function updateOrderStatus(oid, newStatus) {
  if (!newStatus) return;
  const res = await fetch('/api/admin/orders/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: oid, status: newStatus, user_id: state.currentUser.user_id })
  });
  if (res.ok) {
    alert('状态更新成功');
    showAdminDashboard();
  }
}

async function loadReviews() {
  // Only show the review form if a user is logged in
  el('addReviewForm').style.display = state.currentUser ? 'block' : 'none';

  const container = el('reviewList');
  container.innerHTML = '<div style="text-align:center; padding:20px;">加载评价中...</div>';

  const res = await fetch(`/api/reviews?restaurant_id=${state.currentRestaurant.id}`);
  const reviews = await res.json();

  if (reviews.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:#888;">暂无用户评价</div>';
    return;
  }

  container.innerHTML = reviews.map(r => `
    <div style="background:white; padding:20px; border-radius:12px; margin-bottom:15px; box-shadow:0 2px 10px rgba(0,0,0,0.05)">
      <div style="display:flex; justify-content:space-between; margin-bottom:10px">
        <strong>${r.username}</strong>
        <span style="color:#f6ad55">★ ${r.rating}</span>
      </div>
      <p style="color:#666; font-size:0.9rem">${r.comment}</p>
      <div style="font-size:0.75rem; color:#888; margin-top:10px">${new Date(r.created_at * 1000).toLocaleString()}</div>
    </div>
  `).join('');
}

async function handleReviewSubmit() {
  const rating = el('reviewRating').value;
  const comment = el('reviewComment').value;

  if (!comment.trim()) {
    alert('请输入评价内容');
    return;
  }

  const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: state.currentUser.user_id,
      restaurant_id: state.currentRestaurant.id,
      rating: parseInt(rating),
      comment: comment
    })
  });

  if (res.ok) {
    alert('评价提交成功！');
    el('reviewComment').value = ''; // Clear input
    loadReviews(); // Refresh list
  } else {
    alert('提交失败，请重试');
  }
}

// Start
init();
