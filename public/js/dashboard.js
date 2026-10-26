(function () {
    if (!localStorage.getItem('ablogs_token')) {
        location.href = '/login';
        return;
    }

    const token = () => localStorage.getItem('ablogs_token') || '';

    async function api(path, opts = {}) {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
        headers.Authorization = 'Bearer ' + token();
        const res = await fetch(path, Object.assign({}, opts, { headers }));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    }

    function toast(msg) {
        const t = document.getElementById('toast');
        if (!t) return alert(msg);
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2800);
    }

    document.getElementById('btnVA')?.addEventListener('click', async () => {
        const err = document.getElementById('payErr');
        if (err) err.textContent = '';
        const phone = document.getElementById('vaPhone')?.value || '';
        try {
            const data = await api('/api/payments/virtual-account', {
                method: 'POST',
                body: JSON.stringify({ phone })
            });
            const va = data.virtualAccount || {};
            document.getElementById('vaBox')?.classList.remove('hidden');
            document.getElementById('vaBank').textContent = va.bank || 'Bank';
            document.getElementById('vaNumber').textContent = va.accountNumber || '—';
            document.getElementById('vaName').textContent = va.accountName || '';
            toast(data.reused ? 'Your deposit account' : 'Account generated');
        } catch (e) {
            if (err) err.textContent = e.message;
            else toast(e.message);
        }
    });

    document.getElementById('btnCopyVa')?.addEventListener('click', () => {
        const n = document.getElementById('vaNumber')?.textContent || '';
        if (n && navigator.clipboard) {
            navigator.clipboard.writeText(n).then(() => toast('Copied'));
        }
    });

    api('/api/payments/my-virtual-account').then((data) => {
        if (data.phone && document.getElementById('vaPhone')) {
            document.getElementById('vaPhone').value = data.phone;
        }
        const va = data.virtualAccount || {};
        if (va.accountNumber) {
            document.getElementById('vaBox')?.classList.remove('hidden');
            document.getElementById('vaBank').textContent = va.bank || 'Bank';
            document.getElementById('vaNumber').textContent = va.accountNumber;
            document.getElementById('vaName').textContent = va.accountName || '';
        }
    }).catch(() => { });

    // Category + search
    const cat = document.getElementById('catSelect');
    cat && cat.addEventListener('change', () => {
        if (window.AblogsLoadProducts) window.AblogsLoadProducts();
    });
})();
