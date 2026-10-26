(function () {
    const WA_NUMBER = '2348012345678';

    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

    function token() { return localStorage.getItem('ablogs_token') || ''; }
    function setAuth(t, user) {
        if (t) localStorage.setItem('ablogs_token', t);
        if (user) localStorage.setItem('ablogs_user', JSON.stringify(user));
    }
    function clearAuth() {
        localStorage.removeItem('ablogs_token');
        localStorage.removeItem('ablogs_user');
    }

    function toast(msg) {
        const t = $('#toast');
        if (!t) return alert(msg);
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toast._tm);
        toast._tm = setTimeout(() => t.classList.remove('show'), 2800);
    }

    async function api(path, opts = {}) {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
        if (token()) headers.Authorization = 'Bearer ' + token();
        const res = await fetch(path, Object.assign({}, opts, { headers }));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    }

    const overlay = $('#overlay');
    const sidenav = $('#sidenav');
    function openNav() {
        sidenav && sidenav.classList.add('open');
        overlay && overlay.classList.add('show');
    }
    function closeNav() {
        sidenav && sidenav.classList.remove('open');
        overlay && overlay.classList.remove('show');
    }
    $('#btnMenu') && $('#btnMenu').addEventListener('click', openNav);
    $('#btnCloseNav') && $('#btnCloseNav').addEventListener('click', closeNav);
    overlay && overlay.addEventListener('click', closeNav);

    function logout() {
        clearAuth();
        location.href = '/login';
    }
    $('#navLogout') && $('#navLogout').addEventListener('click', logout);

    function openWhatsApp() {
        const msg = encodeURIComponent('Hi Ablogs, I need support.');
        window.open('https://wa.me/' + WA_NUMBER + '?text=' + msg, '_blank');
    }
    $('#fabWa') && $('#fabWa').addEventListener('click', openWhatsApp);

    // Chat ONLY if logged in
    const chatWrap = $('#chatFabWrap');
    if (chatWrap) {
        chatWrap.style.display = token() ? '' : 'none';
    }
    if (!token()) {
        const panel = $('#chatPanel');
        if (panel) panel.remove();
    }

    const chatPanel = $('#chatPanel');
    let chatTimer = null;
    function openChat() {
        if (!token()) return;
        if (chatPanel) chatPanel.classList.add('open');
        loadChat();
        if (chatTimer) clearInterval(chatTimer);
        chatTimer = setInterval(loadChat, 4000);
    }
    function closeChat() {
        if (chatPanel) chatPanel.classList.remove('open');
        if (chatTimer) clearInterval(chatTimer);
    }
    $('#fabChat') && $('#fabChat').addEventListener('click', openChat);
    $('#btnCloseChat') && $('#btnCloseChat').addEventListener('click', closeChat);

    async function loadChat() {
        const box = $('#chatBody');
        if (!box || !token()) return;
        try {
            const data = await api('/api/chat/messages');
            box.innerHTML = '';
            if (!data.messages || !data.messages.length) {
                box.innerHTML = '<div class="bubble system">Hi! How can Ablogs support help you today?</div>';
                return;
            }
            data.messages.forEach((m) => {
                const d = document.createElement('div');
                d.className = 'bubble ' + (m.from === 'user' ? 'user' : 'admin');
                d.textContent = m.text;
                box.appendChild(d);
            });
            box.scrollTop = box.scrollHeight;
        } catch (e) { }
    }

    async function sendChat() {
        if (!token()) return;
        const input = $('#chatInput');
        const text = (input && input.value || '').trim();
        if (!text) return;
        try {
            await api('/api/chat/messages', {
                method: 'POST',
                body: JSON.stringify({ text })
            });
            if (input) input.value = '';
            loadChat();
        } catch (e) {
            toast(e.message || 'Could not send');
        }
    }
    $('#chatSend') && $('#chatSend').addEventListener('click', sendChat);
    $('#chatInput') && $('#chatInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendChat();
    });

    function requireAuth() {
        if (!token()) {
            location.href = '/login';
            return false;
        }
        return true;
    }
    window.AblogsRequireAuth = requireAuth;

    async function loadDashboard() {
        if (!token() || !$('#dashStats')) return;
        try {
            const data = await api('/api/user/dashboard');
            setAuth(token(), data.user);
            $('#headerBalance') && ($('#headerBalance').textContent = '₦' + Number(data.user.balance || 0).toLocaleString());
            $('#navUserName') && ($('#navUserName').textContent = data.user.name || data.user.email);
            const stats = $('#dashStats');
            stats.innerHTML = `
        <div class="stat-card"><div class="label">Account balance</div><div class="value red">₦${Number(data.user.balance || 0).toLocaleString()}</div></div>
        <div class="stat-card" id="cardOrders"><div class="label">Purchases</div><div class="value">${data.orderCount || 0} bought</div></div>
        <div class="stat-card" id="cardTx"><div class="label">Transactions</div><div class="value">View history</div></div>`;
            $('#cardOrders') && $('#cardOrders').addEventListener('click', () => { location.href = '/purchases'; });
            $('#cardTx') && $('#cardTx').addEventListener('click', showTransactions);

            const list = $('#recentList');
            if (list) {
                const rows = (data.recentTx || []).map((t) => {
                    const sign = t.type === 'deposit' || t.type === 'refund' ? '+' : '-';
                    const cls = sign === '+' ? 'amount-in' : 'amount-out';
                    const when = new Date(t.createdAt).toLocaleString();
                    return `<div class="list-row"><div><strong>${t.note || t.type}</strong><div class="muted">${when}</div></div><div class="${cls}">${sign}₦${Number(t.amount).toLocaleString()}</div></div>`;
                });
                list.innerHTML = rows.length ? rows.join('') : '<div class="list-row"><span class="muted">No transactions yet</span></div>';
            }
        } catch (e) {
            if (/session|Login|Unauthorized/i.test(e.message)) {
                clearAuth();
                location.href = '/login';
            }
        }
    }

    function parseDelivery(o) {
        try {
            return typeof o.deliveryInfo === 'string' ? JSON.parse(o.deliveryInfo || '{}') : (o.delivery || {});
        } catch { return {}; }
    }

    async function showOrders() {
        closeNav();
        if (!requireAuth()) return;
        try {
            const data = await api('/api/user/orders');
            const box = $('#recentList');
            if (!box) return;
            $('#recentTitle') && ($('#recentTitle').textContent = 'My orders');
            const rows = (data.orders || []).map((o) => {
                const when = new Date(o.createdAt).toLocaleString();
                return `<div class="list-row" style="cursor:pointer" data-oid="${o._id}">
          <div><strong>${o.productTitle || 'Order'}</strong><div class="muted">${when} · ${o.status} · tap to view</div></div>
          <div class="amount-out">-₦${Number(o.amount).toLocaleString()}</div>
        </div>`;
            });
            box.innerHTML = rows.length ? rows.join('') : '<div class="list-row"><span class="muted">No orders yet</span></div>';
            box.querySelectorAll('[data-oid]').forEach((row) => {
                row.addEventListener('click', () => {
                    const o = (data.orders || []).find((x) => String(x._id) === row.getAttribute('data-oid'));
                    if (o) showDelivery(o);
                });
            });
        } catch (e) { toast(e.message); }
    }

    function showDelivery(order) {
        const d = parseDelivery(order);
        const modal = $('#deliveryModal');
        const body = $('#deliveryBody');
        if (!modal || !body) {
            alert((d.loginDetails || '') + '\n' + (d.previewLink || ''));
            return;
        }
        body.innerHTML = `
      <p><strong>${order.productTitle || 'Product'}</strong></p>
      <p class="muted">Amount: ₦${Number(order.amount).toLocaleString()}</p>
      ${d.imageUrl ? `<img src="${d.imageUrl}" alt="" style="max-width:100%;border-radius:10px;margin:8px 0;" />` : ''}
      <div class="form-group"><label>Login / details</label>
        <textarea id="delLogin" readonly style="width:100%;min-height:80px;padding:10px;border-radius:10px;border:1px solid #e5e7eb;">${d.loginDetails || 'No login text'}</textarea>
      </div>
      ${d.previewLink ? `<p><a href="${d.previewLink}" target="_blank" rel="noopener">Open preview link</a></p>` : ''}
    `;
        modal.classList.add('show');
        window._lastDeliveryText = [
            order.productTitle,
            d.loginDetails,
            d.previewLink
        ].filter(Boolean).join('\n');
    }

    $('#closeDelivery') && $('#closeDelivery').addEventListener('click', () => {
        $('#deliveryModal') && $('#deliveryModal').classList.remove('show');
    });
    $('#btnDownloadDelivery') && $('#btnDownloadDelivery').addEventListener('click', () => {
        const text = window._lastDeliveryText || '';
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ablogs-order.txt';
        a.click();
    });

    async function showTransactions() {
        closeNav();
        if (!requireAuth()) return;
        try {
            const data = await api('/api/user/transactions');
            const box = $('#recentList');
            if (!box) return;
            $('#recentTitle') && ($('#recentTitle').textContent = 'Transaction history');
            const rows = (data.transactions || []).map((t) => {
                const sign = t.type === 'deposit' || t.type === 'refund' ? '+' : '-';
                const cls = sign === '+' ? 'amount-in' : 'amount-out';
                const when = new Date(t.createdAt).toLocaleString();
                return `<div class="list-row"><div><strong>${t.note || t.type}</strong><div class="muted">${when}</div></div><div class="${cls}">${sign}₦${Number(t.amount).toLocaleString()}</div></div>`;
            });
            box.innerHTML = rows.length ? rows.join('') : '<div class="list-row"><span class="muted">No transactions yet</span></div>';
        } catch (e) { toast(e.message); }
    }
    $('#navOrders') && $('#navOrders').addEventListener('click', showOrders);
    $('#navTx') && $('#navTx').addEventListener('click', showTransactions);

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    async function loadProducts(q) {
        const grid = $('#productGrid');
        if (!grid) return;
        const cat = ($('#catSelect') && $('#catSelect').value) || '';
        const query = q != null ? q : (($('#searchInput') && $('#searchInput').value) || '');
        grid.innerHTML = '<div class="muted">Loading…</div>';
        try {
            let url = '/api/products?';
            if (query) url += 'q=' + encodeURIComponent(query) + '&';
            if (cat) url += 'category=' + encodeURIComponent(cat);
            const data = await api(url);
            const list = data.products || [];
            if (!list.length) {
                grid.innerHTML = '<div class="muted">No products found</div>';
                return;
            }
            grid.innerHTML = list.map((p) => `
        <div class="product-card">
          ${p.image ? `<img class="thumb" src="${escapeHtml(p.image)}" alt="" />` : ''}
          <span class="cat">${escapeHtml(p.category)}</span>
          <h4>${escapeHtml(p.title)}</h4>
          <p>${escapeHtml(p.description || '')}</p>
          <div class="muted" style="font-size:0.8rem;">Stock: ${p.stock != null ? p.stock : '—'}</div>
          <div class="price">₦${Number(p.price).toLocaleString()}</div>
          <button class="btn btn-red btn-block btn-buy" data-id="${p._id}">Buy</button>
        </div>`).join('');
            grid.querySelectorAll('.btn-buy').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (!requireAuth()) return;
                    btn.disabled = true;
                    try {
                        const result = await api('/api/user/buy', {
                            method: 'POST',
                            body: JSON.stringify({ productId: btn.getAttribute('data-id') })
                        });
                        toast('Purchase successful');
                        showDelivery({
                            productTitle: result.order.productTitle,
                            amount: result.order.amount,
                            deliveryInfo: JSON.stringify(result.order.delivery || {})
                        });
                        loadDashboard();
                        loadProducts();
                    } catch (e) {
                        toast(e.message);
                    } finally {
                        btn.disabled = false;
                    }
                });
            });
        } catch (e) {
            grid.innerHTML = '<div class="muted">Could not load products</div>';
        }
    }
    window.AblogsLoadProducts = loadProducts;

    function doSearch() {
        loadProducts(($('#searchInput') && $('#searchInput').value) || '');
    }
    $('#btnSearch') && $('#btnSearch').addEventListener('click', doSearch);
    $('#searchInput') && $('#searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
    });
    $('#catSelect') && $('#catSelect').addEventListener('change', () => loadProducts());


    async function loadCategories() {
        const sel = $('#catSelect');
        if (!sel) return;
        try {
            const data = await api('/api/products/meta/categories');
            const cats = data.categories || [];
            const cur = sel.value;
            sel.innerHTML = '<option value="">All</option>' + cats.map(c =>
                '<option value="' + c + '">' + c + '</option>').join('');
            if (cur) sel.value = cur;
        } catch (e) { }
    }

    loadCategories();
    loadDashboard();
    loadProducts();
})();
