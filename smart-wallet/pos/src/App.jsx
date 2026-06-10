import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ShoppingCart, LogOut, CreditCard, Printer } from 'lucide-react';
import { API_URL } from './config';

const POS = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    const t = localStorage.getItem('token');
    return (t === 'null' || t === 'undefined') ? null : t;
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [cardId, setCardId] = useState('');
  const [status, setStatus] = useState({ msg: '', type: '' });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [keypadValue, setKeypadValue] = useState('1');
  const [settings, setSettings] = useState({});
  const [receipt, setReceipt] = useState(null);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } });
      setProducts(res.data);
    } catch (err) {
      setError('Falha ao carregar produtos');
      if (err.response?.status === 401) logout();
    }
  }, [token, logout]);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/settings`, { headers: { Authorization: `Bearer ${token}` } });
      setSettings(res.data);
    } catch (err) {
      console.error('Falha ao carregar definições');
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      const savedUser = JSON.parse(localStorage.getItem('user'));
      if (savedUser && (savedUser.role === 'pos' || savedUser.role === 'admin')) {
        setUser(savedUser);
        fetchProducts();
        fetchSettings();
      } else {
        logout();
      }
    }
  }, [token, fetchProducts, fetchSettings, logout]);

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
      setUser(res.data.user);
      setToken(res.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro no login');
    }
  };

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [logout]);

  const addToCart = (p, qty) => {
    const qtyToAdd = parseInt(qty);
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

    setStatus({ msg: '', type: '' });
    setSelectedProduct(null);
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
      const res = await axios.post(`${API_URL}/sales`, {
        card_id: cardId,
        items: cart.map(i => ({ product_id: i.id, quantity: i.quantity }))
      }, { headers: { Authorization: `Bearer ${token}` } });

      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

      setReceipt({
        id: res.data.id,
        date: formattedDate,
        items: [...cart],
        total: cart.reduce((a, b) => a + ((b.price ?? 0) * b.quantity), 0),
        balance: res.data.remaining_balance,
        card_id: cardId
      });

      setStatus({ msg: 'Venda realizada!', type: 'ok' });
    } catch (err) {
      setStatus({ msg: err.response?.data?.error || 'Erro na venda', type: 'err' });
      if (err.response?.status === 401) logout();
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

  const maskCardId = (id) => {
    if (!id || id.length < 8) return "****";
    return `${id.substring(0, 4)}****${id.substring(id.length - 4)}`;
  };

  const handleNewSale = () => {
    setReceipt(null);
    setCart([]);
    setCardId('');
    setStatus({ msg: '', type: '' });
    fetchProducts();
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print, #receipt-print * { visibility: visible; }
          #receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px;
            font-family: 'Courier New', Courier, monospace;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black text-blue-900 uppercase">Terminal de Vendas</h1>
          <button onClick={logout} className="p-2 text-gray-400 hover:text-red-600 transition"><LogOut/></button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map(p => (
            <button
              key={p.id}
              disabled={p.stock_quantity <= 0}
              onClick={() => { setSelectedProduct(p); setKeypadValue('1'); }}
              className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition text-left flex flex-col ${p.stock_quantity <= 0 ? 'opacity-50 grayscale border-gray-200 cursor-not-allowed' : 'hover:border-blue-500 border-transparent cursor-pointer'}`}
            >
              {p.image_base64 ? <img src={p.image_base64} className="h-32 w-full object-cover" /> : <div className="h-32 bg-gray-100 flex items-center justify-center text-gray-300 font-bold uppercase text-[10px] text-center px-4">Sem Imagem</div>}
              <div className="p-4 flex-1 flex flex-col">
                <h4 className="font-bold text-gray-800 mb-1 leading-tight">{p.name}</h4>
                <p className="text-blue-600 font-black text-lg">{(p.price ?? 0).toFixed(2)} un.</p>
                <p className={`text-[10px] mt-1 font-bold uppercase ${p.stock_quantity <= 0 ? 'text-red-500' : 'text-gray-400'}`}>Stock: {p.stock_quantity}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="w-96 bg-white shadow-2xl flex flex-col border-l relative overflow-hidden">
        {receipt ? (
          <div id="receipt-print" className="flex flex-col h-full bg-white animate-in fade-in duration-300">
             <div className="p-8 flex-1 overflow-y-auto">
                <div className="text-center mb-6">
                   <h2 className="text-2xl font-black text-blue-900 uppercase mb-1">{settings.installationName || 'SmartWallet'}</h2>
                   <p className="text-sm font-bold text-gray-500">{receipt.date}</p>
                   <p className="text-xs font-bold text-gray-400 mt-2 uppercase">Transação: #{receipt.id}</p>
                </div>

                <div className="border-t-2 border-dashed border-gray-200 my-4"></div>

                <div className="space-y-3 mb-6">
                   {receipt.items.map((item, idx) => (
                     <div key={idx} className="flex justify-between text-sm">
                        <div className="flex-1">
                           <p className="font-bold text-gray-800">{item.name}</p>
                           <p className="text-xs text-gray-500">{item.quantity}x @ {(item.price ?? 0).toFixed(2)}</p>
                        </div>
                        <p className="font-black text-gray-900">{((item.quantity * (item.price ?? 0))).toFixed(2)}</p>
                     </div>
                   ))}
                </div>

                <div className="border-t-2 border-dashed border-gray-200 my-4"></div>

                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-500 uppercase text-xs">Total Compra</span>
                      <span className="text-xl font-black text-blue-900">{(receipt.total ?? 0).toFixed(2)} un.</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-500 uppercase text-xs">Saldo Restante</span>
                      <span className="text-lg font-bold text-green-600">{(receipt.balance ?? 0).toFixed(2)} un.</span>
                   </div>
                </div>

                <div className="border-t-2 border-dashed border-gray-200 my-6"></div>

                <div className="text-center">
                   <p className="text-xs font-bold text-gray-400 uppercase mb-1">Cartão: {maskCardId(receipt.card_id)}</p>
                   <p className="text-lg font-black text-blue-900 uppercase tracking-tighter">Obrigado pela sua compra</p>
                </div>
             </div>

             <div className="p-6 bg-gray-50 border-t space-y-3 no-print">
                <button
                   onClick={handleNewSale}
                   className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-2xl hover:bg-green-700 active:scale-95 transition transform shadow-lg"
                >
                   NOVA VENDA
                </button>
                <button
                   onClick={() => window.print()}
                   className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-blue-700 active:scale-95 transition transform flex items-center justify-center gap-2"
                >
                   <Printer size={20} /> IMPRIMIR
                </button>
             </div>
          </div>
        ) : selectedProduct ? (
          <div className="flex flex-col h-full bg-gray-50 animate-in fade-in slide-in-from-right duration-200">
            <div className="p-6 bg-white border-b">
               <h3 className="text-xl font-black text-blue-900 uppercase mb-1">{selectedProduct.name}</h3>
               <p className="text-gray-500 font-bold">Preço Unitário: {(selectedProduct.price ?? 0).toFixed(2)}</p>
            </div>

            <div className="flex-1 flex flex-col p-6 items-center justify-center space-y-8">
               <div className="w-full">
                  <div className={`bg-white p-8 rounded-3xl border-4 text-center ${parseInt(keypadValue) > selectedProduct.stock_quantity ? 'border-red-500' : 'border-blue-100 shadow-inner'}`}>
                     <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Quantidade Seleccionada</p>
                     <span className={`text-6xl font-black ${parseInt(keypadValue) > selectedProduct.stock_quantity ? 'text-red-600' : 'text-blue-900'}`}>{keypadValue}</span>
                     {parseInt(keypadValue) > selectedProduct.stock_quantity && (
                        <p className="text-xs text-red-500 font-bold mt-2 uppercase animate-pulse text-center">Excede Stock! (Max: {selectedProduct.stock_quantity})</p>
                     )}
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
                  {[1,2,3,4,5,6,7,8,9,0].map(n => (
                    <button
                      key={n}
                      onClick={() => setKeypadValue(v => (v === '1' && n !== 0) ? n.toString() : (v === '0' ? n.toString() : v + n.toString()))}
                      className="h-16 bg-white rounded-2xl font-black text-2xl shadow-sm border border-gray-100 hover:bg-blue-50 active:scale-90 transition text-blue-900"
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setKeypadValue(v => v.length > 1 ? v.slice(0, -1) : '1')}
                    className="h-16 bg-red-50 rounded-2xl font-black text-2xl shadow-sm border border-red-100 hover:bg-red-100 active:scale-90 transition text-red-600 flex items-center justify-center col-span-2"
                  >
                    ⌫
                  </button>
               </div>
            </div>

            <div className="p-6 bg-white border-t space-y-3">
               <button
                  disabled={parseInt(keypadValue) === 0 || parseInt(keypadValue) > selectedProduct.stock_quantity}
                  onClick={() => addToCart(selectedProduct, keypadValue)}
                  className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-xl hover:bg-green-700 active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 transition transform"
               >
                  ✓ ADICIONAR
               </button>
               <button
                  onClick={() => setSelectedProduct(null)}
                  className="w-full bg-gray-100 text-gray-500 py-4 rounded-2xl font-black text-lg hover:bg-gray-200 active:scale-95 transition transform"
               >
                  CANCELAR
               </button>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

export default POS;
