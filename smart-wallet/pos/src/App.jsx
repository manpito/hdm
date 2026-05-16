import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, LogOut, CreditCard } from 'lucide-react';
import { API_URL } from './config';

const POS = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({}); // { productId: quantity }
  const [cart, setCart] = useState([]);
  const [cardId, setCardId] = useState('');
  const [status, setStatus] = useState({ msg: '', type: '' });

  useEffect(() => {
    if (token) {
      const savedUser = JSON.parse(localStorage.getItem('user'));
      setUser(savedUser);
      fetchProducts();
    }
  }, [token]);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } });
      setProducts(res.data);
      // Initialize quantities for each product
      const initialQuants = {};
      res.data.forEach(p => initialQuants[p.id] = 1);
      setQuantities(initialQuants);
    } catch (err) { setError('Falha ao carregar produtos'); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { username, password });
      if (res.data.user.role !== 'pos' && res.data.user.role !== 'admin') {
        setError('Apenas utilizadores POS ou Admin podem aceder a este terminal.');
        return;
      }
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro no login');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const addToCart = (p) => {
    const qtyToAdd = parseInt(quantities[p.id] || 1);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) return;

    const existing = cart.find(item => item.id === p.id);
    const currentQtyInCart = existing ? existing.quantity : 0;
    const totalNewQty = currentQtyInCart + qtyToAdd;

    if (totalNewQty > p.stock_quantity) {
      setStatus({ msg: `Stock insuficiente para ${p.name}`, type: 'err' });
      return;
    }

    if (existing) {
      setCart(cart.map(i => i.id === p.id ? { ...i, quantity: totalNewQty } : i));
    } else {
      setCart([...cart, { ...p, quantity: qtyToAdd }]);
    }

    // Reset quantity input to 1 after adding
    setQuantities({ ...quantities, [p.id]: 1 });
    setStatus({ msg: '', type: '' });
  };

  const updateCartQty = (productId, delta) => {
    const product = products.find(p => p.id === productId);
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty > 0 && newQty <= product.stock_quantity) {
          return { ...item, quantity: newQty };
        }
      }
      return item;
    }));
  };

  const checkout = async () => {
    if (!cardId) { setStatus({ msg: 'Aproxime o cartão!', type: 'err' }); return; }
    try {
      await axios.post(`${API_URL}/sales`, {
        card_id: cardId,
        items: cart.map(i => ({ product_id: i.id, quantity: i.quantity }))
      }, { headers: { Authorization: `Bearer ${token}` } });

      setStatus({ msg: 'Venda realizada!', type: 'ok' });
      setCart([]); setCardId('');
      fetchProducts();
    } catch (err) {
      setStatus({ msg: err.response?.data?.error || 'Erro na venda', type: 'err' });
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-900 px-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm">
          <h2 className="text-3xl font-black mb-8 text-center text-blue-900 uppercase tracking-tighter">SmartWallet POS</h2>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm font-bold border border-red-100">{error}</div>}
          <input type="text" placeholder="Utilizador" className="w-full p-4 border-2 border-gray-100 rounded-xl mb-4 focus:border-blue-500 outline-none transition" value={username} onChange={e => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-4 border-2 border-gray-100 rounded-xl mb-6 focus:border-blue-500 outline-none transition" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg hover:bg-blue-700 active:scale-95 transition transform">ENTRAR</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black text-blue-900 uppercase">Terminal de Vendas</h1>
          <button onClick={logout} className="p-2 text-gray-400 hover:text-red-600 transition"><LogOut/></button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map(p => (
            <div
              key={p.id}
              className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition text-left flex flex-col ${p.stock_quantity <= 0 ? 'opacity-50 grayscale border-gray-200' : 'hover:border-blue-500 border-transparent'}`}
            >
              {p.image_base64 ? <img src={p.image_base64} className="h-32 w-full object-cover" /> : <div className="h-32 bg-gray-100 flex items-center justify-center text-gray-300 font-bold uppercase text-[10px] text-center px-4">Sem Imagem</div>}
              <div className="p-4 flex-1 flex flex-col">
                <h4 className="font-bold text-gray-800 mb-1 leading-tight">{p.name}</h4>
                <p className="text-blue-600 font-black text-lg">{(p.price ?? 0).toFixed(2)} un.</p>
                <p className={`text-[10px] mt-1 font-bold uppercase ${p.stock_quantity <= 0 ? 'text-red-500' : 'text-gray-400'}`}>Stock: {p.stock_quantity}</p>

                {p.stock_quantity > 0 && (
                  <div className="mt-auto pt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Qtd:</label>
                      <input
                        type="number"
                        min="1"
                        max={p.stock_quantity}
                        value={quantities[p.id] || 1}
                        onChange={(e) => setQuantities({ ...quantities, [p.id]: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full p-1 border rounded font-bold text-center ${parseInt(quantities[p.id]) > p.stock_quantity ? 'border-red-500 text-red-600' : 'border-gray-200'}`}
                      />
                    </div>
                    {parseInt(quantities[p.id]) > p.stock_quantity && (
                      <p className="text-[9px] text-red-500 font-bold uppercase">Excede Stock!</p>
                    )}
                    <button
                      onClick={() => addToCart(p)}
                      className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold text-xs hover:bg-blue-700 active:scale-95 transition transform"
                    >
                      ADICIONAR
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-96 bg-white shadow-2xl flex flex-col border-l">
        <div className="p-6 border-b flex items-center gap-3">
          <ShoppingCart className="text-blue-600" />
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Carrinho</h2>
        </div>

        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {cart.length === 0 && <p className="text-gray-400 italic text-center mt-20">Carrinho vazio</p>}
          {cart.map(item => (
            <div key={item.id} className="flex flex-col bg-gray-50 p-3 rounded-xl border gap-2">
              <div className="flex justify-between items-start">
                <p className="font-bold text-sm">
                  {item.quantity}x {item.name} — {(item.quantity * item.price).toFixed(2)}
                </p>
                <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-red-400 hover:text-red-600 font-bold">X</button>
              </div>
              <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-100">
                 <div className="flex items-center gap-3">
                    <button onClick={() => updateCartQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full font-bold hover:bg-gray-200">-</button>
                    <span className="font-black text-blue-900">{item.quantity}</span>
                    <button onClick={() => updateCartQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full font-bold hover:bg-gray-200">+</button>
                 </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-gray-50 border-t space-y-4">
          <div className="flex justify-between items-end mb-2">
            <span className="text-gray-500 font-bold uppercase text-xs">Total a pagar</span>
            <span className="text-3xl font-black text-blue-900">{(cart.reduce((a,b)=>a+(b.price*b.quantity), 0) ?? 0).toFixed(2)} un.</span>
          </div>

          <div className="relative">
             <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
             <input
              type="text"
              placeholder="UID do Cartão"
              className="w-full pl-12 p-4 bg-white border-2 border-gray-200 rounded-xl font-bold focus:border-blue-600 outline-none"
              value={cardId}
              onChange={e => setCardId(e.target.value)}
            />
          </div>

          <button
            disabled={cart.length === 0}
            onClick={checkout}
            className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xl hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 transition"
          >
            PAGAR AGORA
          </button>

          {status.msg && (
            <div className={`p-4 rounded-xl text-center font-bold text-sm ${status.type === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {status.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default POS;
