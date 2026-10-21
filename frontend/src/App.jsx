import { useEffect, useState } from 'react';

const money = (n) => '₹' + Number(n).toLocaleString('en-IN');

// Small wrapper around fetch that adds the login token and throws on errors
async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function App() {
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem('session') || 'null'));
  const [view, setView] = useState('shop');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState('');
  const token = session?.token;

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000); };
  const logout = () => { localStorage.removeItem('session'); setSession(null); setCart([]); setOrders([]); };

  useEffect(() => { api('/products').then(setProducts).catch((e) => flash(e.message)); }, []);
  useEffect(() => {
    if (!token) return;
    api('/cart', { token }).then(setCart).catch(logout);
    api('/orders', { token }).then(setOrders).catch(() => {});
  }, [token]);

  async function saveCart(items) {
    setCart(items);
    try { await api('/cart', { method: 'PUT', token, body: { items } }); } catch (e) { flash(e.message); }
  }

  function addToCart(id) {
    if (!token) return setView('account');
    const found = cart.find((i) => i.productId === id);
    saveCart(found ? cart.map((i) => (i.productId === id ? { ...i, qty: i.qty + 1 } : i)) : [...cart, { productId: id, qty: 1 }]);
  }

  async function checkout() {
    try {
      const o = await api('/orders', { method: 'POST', token });
      setCart([]);
      setOrders(await api('/orders', { token }));
      setView('orders');
      flash(`Order #${o.orderId} placed. A confirmation email is on its way.`);
    } catch (e) { flash(e.message); }
  }

  async function submitAccount(e, mode) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      const s = await api(mode === 'register' ? '/register' : '/login', { method: 'POST', body: f });
      localStorage.setItem('session', JSON.stringify(s));
      setSession(s);
      setView('shop');
      if (mode === 'register') flash('Account created. Check your inbox and confirm the email subscription to get order updates.');
    } catch (err) { flash(err.message); }
  }

  const lines = cart.map((i) => ({ ...i, p: products.find((p) => p.id === i.productId) })).filter((l) => l.p);
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <>
      <header>
        <h1>Deskcraft</h1>
        <nav>
          <button className={view === 'shop' ? 'on' : ''} onClick={() => setView('shop')}>Shop</button>
          {token && <button className={view === 'cart' ? 'on' : ''} onClick={() => setView('cart')}>Cart ({count})</button>}
          {token && <button className={view === 'orders' ? 'on' : ''} onClick={() => setView('orders')}>My orders</button>}
          {token ? <button onClick={logout}>Log out ({session.name})</button>
                 : <button className={view === 'account' ? 'on' : ''} onClick={() => setView('account')}>Log in</button>}
        </nav>
      </header>

      {msg && <p className="msg" role="status">{msg}</p>}

      <main>
        {view === 'shop' && (
          <section className="grid">
            {products.map((p) => (
              <article key={p.id}>
                <img src={p.image_url} alt={p.name} />
                <h2>{p.name}</h2>
                <p>{p.description}</p>
                <footer><strong>{money(p.price)}</strong><button onClick={() => addToCart(p.id)}>Add to cart</button></footer>
              </article>
            ))}
          </section>
        )}

        {view === 'cart' && (
          <section>
            <h2>Your cart</h2>
            {!lines.length && <p>Your cart is empty. Add something from the shop.</p>}
            {lines.map((l) => (
              <div className="row" key={l.productId}>
                <span>{l.p.name}</span>
                <span>
                  <button onClick={() => saveCart(cart.map((i) => (i.productId === l.productId ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0))}>−</button>
                  {' '}{l.qty}{' '}
                  <button onClick={() => addToCart(l.productId)}>+</button>
                </span>
                <span>{money(l.p.price * l.qty)}</span>
              </div>
            ))}
            {!!lines.length && <div className="row total"><span>Total</span><span /><span>{money(total)}</span></div>}
            {!!lines.length && <button className="primary" onClick={checkout}>Place order</button>}
          </section>
        )}

        {view === 'orders' && (
          <section>
            <h2>My orders</h2>
            {!orders.length && <p>No orders yet.</p>}
            {orders.map((o) => (
              <div className="row" key={o.id}>
                <span>Order #{o.id}</span>
                <span>{new Date(o.created_at).toLocaleDateString('en-IN')}</span>
                <span>{money(o.total)}</span>
              </div>
            ))}
          </section>
        )}

        {view === 'account' && (
          <section className="account">
            <AccountForm title="Log in" fields={['email', 'password']} onSubmit={(e) => submitAccount(e, 'login')} />
            <AccountForm title="Create account" fields={['name', 'email', 'password']} onSubmit={(e) => submitAccount(e, 'register')} />
          </section>
        )}
      </main>
    </>
  );
}

function AccountForm({ title, fields, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <h2>{title}</h2>
      {fields.map((f) => (
        <label key={f}>{f[0].toUpperCase() + f.slice(1)}
          <input name={f} type={f === 'password' ? 'password' : f === 'email' ? 'email' : 'text'} required minLength={f === 'password' ? 6 : undefined} />
        </label>
      ))}
      <button className="primary">{title}</button>
    </form>
  );
}
