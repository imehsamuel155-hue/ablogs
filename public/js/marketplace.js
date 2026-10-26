const Market = (function () {
    function token() { return localStorage.getItem('ablogs_token') || ''; }
    function requireAuth() {
        if (!token()) { location.href = '/login'; return false; }
        return true;
    }
    function toast(msg) {
        const t = document.getElementById('toast');
        if (!t) return alert(msg);
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    }
    async function api(path, opts = {}) {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
        if (token()) headers.Authorization = 'Bearer ' + token();
        const res = await fetch(path, Object.assign({}, opts, { headers }));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    }
    function money(n) { return '₦' + Number(n || 0).toLocaleString(); }
    function escape(s) {
        return String(s || '').replace(/[&<>"']/g, (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function wireDrawer() {
        const drawer = document.getElementById('drawer');
        document.getElementById('btnMenu')?.addEventListener('click', () => drawer?.classList.add('open'));
        document.getElementById('drawerDim')?.addEventListener('click', () => drawer?.classList.remove('open'));
        document.getElementById('navLogout')?.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            location.href = '/login';
        });
    }

    let settings = null;
    async function loadSettings() {
        try {
            const d = await api('/api/user/settings-public');
            settings = d.settings;
            return settings;
        } catch { return null; }
    }
    function applyCommunity(s) {
        if (!s) return;
        const title = document.getElementById('comTitle');
        const text = document.getElementById('comText');
        const site = document.getElementById('comSite');
        const wa = document.getElementById('comWa');
        const tg = document.getElementById('comTg');
        const wg = document.getElementById('comWg');
        if (title) title.textContent = s.welcomeTitle || 'Stay Connected';
        if (text) text.innerHTML = (s.stayConnectedHtml || '').replace(/\n/g, '<br>');
        if (site) site.textContent = s.siteName || 'Ablogs';
        const num = String(s.whatsappNumber || '2348022313937').replace(/\D/g, '');
        const waLink = 'https://wa.me/' + num;
        const groupLink = s.whatsappGroupLink || 'https://chat.whatsapp.com/JdTW56VIf5GFo0Rzr5GQoE';
        if (wa) wa.href = waLink;
        const com = document.getElementById('comCommunity');
        if (com) { com.href = groupLink; com.style.display = ''; }
        if (tg && s.telegramLink) { tg.href = s.telegramLink; tg.style.display = ''; }
        if (wg) { wg.href = groupLink; wg.style.display = ''; }
        const brand = document.getElementById('siteBrand');
        if (brand && s.siteName) brand.textContent = s.siteName;
        document.getElementById('navWhatsApp')?.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(groupLink, '_blank');
        });
    }

    function wireTimeGreeting() {
        function tick() {
            const now = new Date();
            const h = now.getHours();
            const m = String(now.getMinutes()).padStart(2, '0');
            const clock = document.getElementById('clockTime');
            if (clock) {
                const hour12 = ((h + 11) % 12) + 1;
                const ampm = h >= 12 ? 'PM' : 'AM';
                clock.textContent = hour12 + ':' + m + ' ' + ampm;
            }
            const greet = document.getElementById('greetText');
            if (greet) {
                if (h < 12) greet.textContent = 'Good morning';
                else if (h < 17) greet.textContent = 'Good afternoon';
                else greet.textContent = 'Good evening';
            }
        }
        tick();
        setInterval(tick, 15000);
    }

    function showAnnouncement(s) {
        // Show every time customer opens dashboard (every login session visit)
        if (!s || s.announcementEnabled === false) return;
        const overlay = document.getElementById('annOverlay');
        if (!overlay) return;
        document.getElementById('annTitleEl').textContent = s.announcementTitle || s.welcomeTitle || 'Welcome to Ablogs Marketplace';
        document.getElementById('annSubEl').textContent = s.announcementSubtitle || 'Your Trusted Logs Store';
        let body = s.announcementBody || s.stayConnectedHtml || '';
        if (body.indexOf('Join community') === -1) {
            body += '\n\nJoin community: https://chat.whatsapp.com/JdTW56VIf5GFo0Rzr5GQoE';
        }
        document.getElementById('annBodyEl').innerHTML = body.replace(/\n/g, '<br>');
        const group = (s.whatsappGroupLink || 'https://chat.whatsapp.com/JdTW56VIf5GFo0Rzr5GQoE');
        const num = String(s.whatsappNumber || '2348022313937').replace(/\D/g, '');
        const annCom = document.getElementById('annCommunity');
        const annWa = document.getElementById('annWa');
        if (annCom) annCom.href = group;
        if (annWa) annWa.href = 'https://wa.me/' + num;
        overlay.style.display = 'flex';
        document.getElementById('annClose')?.addEventListener('click', () => {
            overlay.style.display = 'none';
        }, { once: true });
    }

    function openChat() {
        const full = document.getElementById('chatFull');
        if (full) {
            full.classList.add('open');
            document.body.classList.add('chat-open');
            loadChat();
        }
    }
    function closeChat() {
        const full = document.getElementById('chatFull');
        if (full) full.classList.remove('open');
        document.body.classList.remove('chat-open');
        location.href = '/dashboard';
    }

    async function loadChat() {
        const box = document.getElementById('chatBody');
        if (!box) return;
        try {
            const data = await api('/api/chat/messages');
            box.innerHTML = '';
            (data.messages || []).forEach((m) => {
                const d = document.createElement('div');
                d.className = 'bubble-x ' + (m.from === 'user' ? 'bubble-u' : 'bubble-a');
                if (m.image) {
                    const img = document.createElement('img');
                    img.src = m.image;
                    img.style.cssText = 'max-width:180px;border-radius:10px;display:block;margin-bottom:4px;cursor:pointer;';
                    img.onclick = () => window.open(m.image, '_blank');
                    d.appendChild(img);
                }
                if (m.text && m.text !== '[Photo]') {
                    const t = document.createElement('div');
                    t.textContent = m.text;
                    d.appendChild(t);
                }
                box.appendChild(d);
            });
            if (!(data.messages || []).length) {
                box.innerHTML = '<div class="bubble-x bubble-a">Hi! How can we help you today?</div>';
            }
            box.scrollTop = box.scrollHeight;
        } catch (_) { }
    }


    function wireHelpBubble() {
        const bubble = document.getElementById('helpBubble');
        const badge = document.getElementById('chatBadge');
        if (!bubble) return;
        const key = 'ablogs_help_dismissed';
        if (sessionStorage.getItem(key)) {
            bubble.classList.add('hide');
            badge && badge.classList.add('hide');
        }
        document.getElementById('helpBubbleX')?.addEventListener('click', (e) => {
            e.stopPropagation();
            bubble.classList.add('hide');
            sessionStorage.setItem(key, '1');
        });
        document.getElementById('helpBubbleOpen')?.addEventListener('click', () => {
            bubble.classList.add('hide');
            badge && badge.classList.add('hide');
            sessionStorage.setItem(key, '1');
            openChat();
        });
        document.getElementById('bottomChat')?.addEventListener('click', () => {
            badge && badge.classList.add('hide');
            bubble.classList.add('hide');
            sessionStorage.setItem(key, '1');
        });
    }

    function wireChat() {
        const full = document.getElementById('chatFull');
        if (!full || !token()) return;
        document.getElementById('btnCloseChat')?.addEventListener('click', (e) => {
            e.preventDefault();
            closeChat();
        });
        document.getElementById('navLiveChat')?.addEventListener('click', (e) => { e.preventDefault(); openChat(); });
        document.getElementById('bottomChat')?.addEventListener('click', (e) => { e.preventDefault(); openChat(); });
        document.getElementById('fabChat')?.addEventListener('click', openChat);

        document.getElementById('chatSend')?.addEventListener('click', async () => {
            const input = document.getElementById('chatInput');
            const text = (input?.value || '').trim();
            if (!text) return;
            try {
                await api('/api/chat/messages', { method: 'POST', body: JSON.stringify({ text }) });
                input.value = '';
                loadChat();
            } catch (e) { toast(e.message); }
        });

        document.getElementById('chatPhoto')?.addEventListener('change', async function () {
            const f = this.files && this.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    await api('/api/chat/messages', {
                        method: 'POST',
                        body: JSON.stringify({ text: '', image: reader.result })
                    });
                    loadChat();
                } catch (e) { toast(e.message); }
                this.value = '';
            };
            reader.readAsDataURL(f);
        });
    }

    function wireWhatsAppFab() {
        document.getElementById('fabWa')?.addEventListener('click', async () => {
            if (!settings) await loadSettings();
            // Floating icon → WhatsApp community group
            const group = (settings && settings.whatsappGroupLink) || 'https://chat.whatsapp.com/JdTW56VIf5GFo0Rzr5GQoE';
            window.open(group, '_blank');
        });
    }

    function renderLogCards(list, grid) {
        if (!grid) return;
        grid.innerHTML = list.map((p) => `
      <a class="cat-card" href="/category?id=${p._id}">
        <div class="ico" style="display:flex;align-items:center;justify-content:center;min-height:48px;">
          ${p.image
                ? `<img src="${escape(p.image)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px;" />`
                : `<span style="font-weight:800;color:#dc2626;">${escape((p.category || 'LOG').slice(0, 3).toUpperCase())}</span>`}
        </div>
        <h3>${escape(p.title)}</h3>
        <p>${escape(p.description || '')}</p>
        <div style="margin-top:8px;font-size:0.82rem;color:#64748b;">
          ${money(p.price)} · ${p.piecesLeft != null ? p.piecesLeft : p.stock} pieces
        </div>
      </a>
    `).join('') || '<p class="muted">No logs yet</p>';
    }

    async function initDashboard() {
        if (!requireAuth()) return;
        wireDrawer(); wireTimeGreeting(); wireChat();
        wireHelpBubble(); wireWhatsAppFab();
        const s = await loadSettings();
        applyCommunity(s);
        showAnnouncement(s);

        try {
            const data = await api('/api/user/dashboard');
            const u = data.user;
            localStorage.setItem('ablogs_user', JSON.stringify(u));
            document.getElementById('userFirst').textContent = (u.name || 'User').split(' ')[0];
            document.getElementById('drawerName').textContent = u.name || u.email;
            const balEl = document.getElementById('walletBal');
            if (balEl) balEl.textContent = money(u.balance);
            const so = document.getElementById('statOrders');
            if (so) so.textContent = data.orderCount || 0;
            const ss = document.getElementById('statSpent');
            if (ss) ss.textContent = money(data.totalSpent || 0);
            const sd = document.getElementById('statDeposits');
            if (sd) sd.textContent = money(data.totalDeposited || 0);
            const st = document.getElementById('statDepositTimes');
            if (st) st.textContent = data.depositCount || 0;
            const box = document.getElementById('recentOrdersBox');
            if (data.recentOrders && data.recentOrders.length) {
                box.innerHTML = data.recentOrders.map((o) =>
                    `<div style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
            <strong>${escape(o.productTitle || 'Order')}</strong>
            <div style="font-size:0.8rem;color:#6b7280;">${new Date(o.createdAt).toLocaleString()} · ${money(o.amount)}</div>
          </div>`
                ).join('');
            }
        } catch (e) {
            if (/session|Login/i.test(e.message)) { localStorage.clear(); location.href = '/login'; }
        }

        document.getElementById('btnFund')?.addEventListener('click', () => location.href = '/wallet');
        document.getElementById('btnBrowse')?.addEventListener('click', () => location.href = '/products');
        document.getElementById('goOrders')?.addEventListener('click', () => location.href = '/purchases');

        // Search + category on dashboard
        let allLogs = [];
        try {
            const d = await api('/api/products');
            allLogs = d.products || [];
            // fill category select with real categories
            const sel = document.getElementById('dashCat');
            if (sel) {
                const cats = [...new Set(allLogs.map((p) => p.category).filter(Boolean))];
                cats.forEach((c) => {
                    if (![...sel.options].some((o) => o.value === c)) {
                        const o = document.createElement('option');
                        o.value = c; o.textContent = c.charAt(0).toUpperCase() + c.slice(1);
                        sel.appendChild(o);
                    }
                });
            }
        } catch (_) { }

        function filterDash() {
            const q = (document.getElementById('dashSearch')?.value || '').toLowerCase();
            const cat = (document.getElementById('dashCat')?.value || '').toLowerCase();
            let list = allLogs;
            if (cat) list = list.filter((p) => (p.category || '').toLowerCase() === cat);
            if (q) list = list.filter((p) => (p.title + p.category + (p.description || '')).toLowerCase().includes(q));
            renderLogCards(list.slice(0, 12), document.getElementById('dashSearchResults'));
        }
        document.getElementById('dashSearch')?.addEventListener('input', filterDash);
        document.getElementById('dashCat')?.addEventListener('change', filterDash);
    }

    async function initProducts() {
        if (!requireAuth()) return;
        wireDrawer(); wireChat(); wireWhatsAppFab();
        try {
            const dash = await api('/api/user/dashboard');
            const pill = document.getElementById('balPill');
            if (pill) pill.textContent = money(dash.user.balance);
        } catch (_) { }
        const grid = document.getElementById('catGrid');
        try {
            const data = await api('/api/products');
            const all = data.products || [];
            renderLogCards(all, grid);
            const sel = document.getElementById('filterCat');
            if (sel) {
                const cats = [...new Set(all.map((p) => p.category).filter(Boolean))];
                cats.forEach((c) => {
                    if (![...sel.options].some((o) => o.value === c)) {
                        const o = document.createElement('option');
                        o.value = c;
                        o.textContent = c.charAt(0).toUpperCase() + c.slice(1);
                        sel.appendChild(o);
                    }
                });
                sel.addEventListener('change', () => {
                    const c = sel.value.toLowerCase();
                    renderLogCards(c ? all.filter((p) => (p.category || '').toLowerCase() === c) : all, grid);
                });
            }
            document.getElementById('searchCat')?.addEventListener('input', (e) => {
                const q = e.target.value.toLowerCase();
                const c = (document.getElementById('filterCat')?.value || '').toLowerCase();
                let list = all;
                if (c) list = list.filter((p) => (p.category || '').toLowerCase() === c);
                if (q) list = list.filter((p) => (p.title + p.category + (p.description || '')).toLowerCase().includes(q));
                renderLogCards(list, grid);
            });
        } catch (e) {
            if (grid) grid.innerHTML = '<p class="muted">Could not load</p>';
        }
    }

    async function initCategory() {
        if (!requireAuth()) return;
        wireDrawer(); wireChat();
        const id = new URLSearchParams(location.search).get('id');
        let balance = 0;
        try {
            const dash = await api('/api/user/dashboard');
            balance = Number(dash.user.balance || 0);
            const bp = document.getElementById('balPill');
            if (bp) bp.textContent = money(balance);
        } catch (_) { }

        const box = document.getElementById('productList');
        if (!id || !box) return;
        try {
            const d = await api('/api/products/' + id);
            const p = d.product;
            if (!p) { box.innerHTML = '<p class="muted">Not found</p>'; return; }
            const titleEl = document.getElementById('catTitle');
            if (titleEl) titleEl.textContent = p.title;

            const accounts = p.accounts || [];
            box.innerHTML = `
        <div class="list-card" style="padding:16px;margin-bottom:12px;">
          <div style="display:flex;gap:12px;align-items:center;">
            ${p.image ? `<img src="${escape(p.image)}" style="width:64px;height:64px;object-fit:cover;border-radius:12px;" />` : ''}
            <div>
              <h3 style="margin:0 0 4px;">${escape(p.title)}</h3>
              <div class="muted" style="font-size:0.85rem;">${money(p.price)} · ${p.piecesLeft} pieces left</div>
            </div>
          </div>
          <p style="margin:10px 0 0;font-size:0.9rem;color:#64748b;">${escape(p.description || '')}</p>
        </div>
        <div class="list-card" style="padding:12px 16px;">
          <strong style="font-size:0.9rem;">Available accounts</strong>
          <div id="acctList">
            ${accounts.map((a) => `
              <div class="acct-row">
                <span class="idx">${a.index}.</span>
                ${a.previewLink
                    ? `<a class="eye-btn" href="${escape(a.previewLink)}" target="_blank" rel="noopener" title="View account">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    </a>`
                    : `<span class="eye-btn" style="opacity:.35;pointer-events:none;">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    </span>`}
                <button type="button" class="btn btn-red btn-buy-one" data-stock="${a.id}" data-price="${p.price}" style="margin-left:auto;padding:8px 14px;border-radius:999px;">Buy</button>
              </div>
            `).join('') || '<p class="muted" style="padding:10px 0;">No pieces left</p>'}
          </div>
        </div>
      `;

            box.querySelectorAll('.btn-buy-one').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const price = Number(btn.getAttribute('data-price'));
                    if (balance < price) {
                        toast('Please fund your account. Your balance is not enough.');
                        return;
                    }
                    btn.disabled = true;
                    btn.textContent = '…';
                    try {
                        const r = await api('/api/user/buy', {
                            method: 'POST',
                            body: JSON.stringify({
                                productId: p._id,
                                stockItemId: btn.getAttribute('data-stock')
                            })
                        });
                        balance = Number(r.balance || balance);
                        const login = (r.order && r.order.delivery && r.order.delivery.loginDetails) || '';
                        toast('Purchase successful');
                        const modal = document.createElement('div');
                        modal.className = 'ann-overlay';
                        modal.style.display = 'flex';
                        modal.innerHTML = `
              <div class="ann-card">
                <button type="button" class="ann-x" id="okClose">×</button>
                <h2 style="color:#16a34a;">Successful</h2>
                <textarea id="okLogin" readonly style="width:100%;min-height:90px;padding:10px;border-radius:10px;border:1px solid #e5e7eb;margin:10px 0;">${escape(login)}</textarea>
                <button type="button" class="btn btn-red" id="okCopy" style="width:100%;">Copy login</button>
                <a href="/purchases" class="btn btn-white" style="display:block;text-align:center;margin-top:8px;">View Orders</a>
              </div>`;
                        document.body.appendChild(modal);
                        document.getElementById('okClose').onclick = () => { modal.remove(); location.reload(); };
                        document.getElementById('okCopy').onclick = () => {
                            const ta = document.getElementById('okLogin');
                            navigator.clipboard?.writeText(ta.value).then(() => toast('Copied')).catch(() => {
                                ta.select(); document.execCommand('copy'); toast('Copied');
                            });
                        };
                    } catch (e) {
                        toast(e.message || 'Please fund your account. Your balance is not enough.');
                    } finally {
                        btn.disabled = false;
                        btn.textContent = 'Buy';
                    }
                });
            });
        } catch (e) {
            toast(e.message);
        }
    }

    async function initWallet() {
        if (!requireAuth()) return;
        wireDrawer(); wireChat(); wireWhatsAppFab();
        try {
            const dash = await api('/api/user/dashboard');
            const el = document.getElementById('walletBal');
            if (el) el.textContent = money(dash.user.balance);
        } catch (_) { }
        document.getElementById('btnCreateVA')?.addEventListener('click', async () => {
            try {
                const r = await api('/api/payments/virtual-account', { method: 'POST', body: '{}' });
                const box = document.getElementById('vaBox');
                if (box) {
                    box.innerHTML = `
            <p><strong>Account name:</strong> ${escape(r.accountName || r.account_name || '')}</p>
            <p><strong>Account number:</strong> ${escape(r.accountNumber || r.account_number || '')}</p>
            <p><strong>Bank:</strong> ${escape(r.bankName || r.bank_name || '')}</p>
            <p class="muted">Transfer any amount — it credits your wallet automatically.</p>`;
                }
            } catch (e) { toast(e.message); }
        });
    }

    async function initProfile() {
        if (!requireAuth()) return;
        wireDrawer(); wireChat();
        try {
            const dash = await api('/api/user/dashboard');
            const u = dash.user;
            const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
            set('pfName', u.name); set('pfEmail', u.email); set('pfPhone', u.phone);
        } catch (_) { }
        document.getElementById('btnSaveProfile')?.addEventListener('click', async () => {
            try {
                const pass = document.getElementById('pfPass')?.value || '';
                if (!pass || pass.length < 6) return toast('Enter a new password (min 6 characters)');
                const btn = document.getElementById('btnSaveProfile');
                if (btn) { btn.disabled = true; btn.textContent = '......'; }
                await api('/api/user/profile', {
                    method: 'PUT',
                    body: JSON.stringify({ password: pass })
                });
                toast('Saved');
            } catch (e) { toast(e.message); }
        });
    }

    async function initWorkingPictures() {
        if (!requireAuth()) return;
        wireDrawer(); wireChat();
        let balance = 0;
        try {
            const dash = await api('/api/user/dashboard');
            balance = Number(dash.user.balance || 0);
        } catch (_) { }
        const grid = document.getElementById('wpGrid');
        try {
            const d = await api('/api/user/working-pictures');
            if (!grid) return;
            grid.innerHTML = (d.items || []).map((it) => {
                const previews = (it.previewImages && it.previewImages.length)
                    ? it.previewImages
                    : (it.coverImage ? [it.coverImage] : []);
                return `
        <div class="list-card" style="padding:12px;margin-bottom:12px;">
          <div style="display:flex;gap:6px;overflow-x:auto;">
            ${previews.map((src) =>
                    `<img src="${escape(src)}" style="width:100px;height:100px;object-fit:cover;border-radius:10px;cursor:pointer;" onclick="window.open(this.src,'_blank')" />`
                ).join('') || '<div class="muted">No preview</div>'}
          </div>
          <h3 style="margin:10px 0 4px;">${escape(it.title)}</h3>
          <div class="muted" style="font-size:0.85rem;">${escape(it.gender || '')} · ${it.picturesCount || 0} pics · ${it.videosCount || 0} videos</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
            <strong>${money(it.price)}</strong>
            <button type="button" class="btn btn-red btn-wp-buy" data-id="${it._id}" data-price="${it.price}">Purchase</button>
          </div>
        </div>`;
            }).join('') || '<p class="muted">No packs yet</p>';
            grid.querySelectorAll('.btn-wp-buy').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (balance < Number(btn.getAttribute('data-price'))) {
                        return toast('Please fund your account. Your balance is not enough.');
                    }
                    const old = btn.textContent;
                    btn.disabled = true; btn.textContent = '......';
                    try {
                        const r = await api('/api/user/working-pictures/buy', {
                            method: 'POST',
                            body: JSON.stringify({ id: btn.getAttribute('data-id') })
                        });
                        balance = Number(r.balance || balance);
                        toast(r.message || 'Purchase successful');
                        if (r.telegramLink) setTimeout(() => window.open(r.telegramLink, '_blank'), 500);
                    } catch (e) { toast(e.message); btn.disabled = false; btn.textContent = old; }
                });
            });
        } catch (e) {
            if (grid) grid.innerHTML = '<p class="muted">Could not load</p>';
        }
    }


    async function initPackPage(kind) {
        if (!requireAuth()) return;
        wireDrawer(); wireChat(); wireWhatsAppFab();
        let balance = 0;
        try {
            const dash = await api('/api/user/dashboard');
            balance = Number(dash.user.balance || 0);
            const bp = document.getElementById('balPill');
            if (bp) bp.textContent = money(balance);
        } catch (_) { }
        const grid = document.getElementById('packGrid') || document.getElementById('wpGrid');
        try {
            const d = await api('/api/user/working-pictures?kind=' + encodeURIComponent(kind || 'working'));
            if (!grid) return;
            grid.innerHTML = (d.items || []).map((it) => {
                const previews = (it.previewImages && it.previewImages.length)
                    ? it.previewImages.slice(0, 3)
                    : (it.coverImage ? [it.coverImage] : []);
                return `
        <div class="list-card" style="padding:12px;margin-bottom:12px;">
          <div style="display:flex;gap:6px;overflow-x:auto;">
            ${previews.map((src) =>
                    `<img src="${escape(src)}" style="width:100px;height:100px;object-fit:cover;border-radius:10px;cursor:pointer;" onclick="window.open(this.src,'_blank')" />`
                ).join('') || '<div class="muted">No preview</div>'}
          </div>
          <h3 style="margin:10px 0 4px;">${escape(it.title)}</h3>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
            <strong>${money(it.price)}</strong>
            <button type="button" class="btn btn-red btn-wp-buy" data-id="${it._id}" data-price="${it.price}">Buy</button>
          </div>
        </div>`;
            }).join('') || '<p class="muted">Nothing listed yet</p>';
            grid.querySelectorAll('.btn-wp-buy').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (balance < Number(btn.getAttribute('data-price'))) {
                        return toast('Please fund your account. Your balance is not enough.');
                    }
                    try {
                        const r = await api('/api/user/working-pictures/buy', {
                            method: 'POST',
                            body: JSON.stringify({ id: btn.getAttribute('data-id') })
                        });
                        balance = Number(r.balance || balance);
                        toast(r.message || 'Purchase successful');
                        if (r.telegramLink) setTimeout(() => window.open(r.telegramLink, '_blank'), 400);
                    } catch (e) { toast(e.message); }
                });
            });
        } catch (e) {
            if (grid) grid.innerHTML = '<p class="muted">Could not load</p>';
        }
    }

    return {
        initDashboard,
        initProducts,
        initCategory,
        initWallet,
        initProfile,
        initWorkingPictures,
        initPackPage
    };
})();
