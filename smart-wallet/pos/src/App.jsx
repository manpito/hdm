import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { ShoppingCart, LogOut, CreditCard, Printer, ChevronUp, ChevronDown, X, Check } from 'lucide-react';
import { API_URL } from './config';

/**
 * Helper to compute high-contrast text color (black or white)
 * based on the background color luminance (YIQ formula).
 */
const getContrastColor = (hexColor) => {
  if (!hexColor || typeof hexColor !== 'string') return '#ffffff';
  let color = hexColor.trim().replace('#', '');
  if (color.length === 3) {
    color = color.split('').map(c => c + c).join('');
  }
  if (color.length !== 6) return '#ffffff';
  const r = parseInt(color.substring(0, 2), 16) || 0;
  const g = parseInt(color.substring(2, 4), 16) || 0;
  const b = parseInt(color.substring(4, 6), 16) || 0;
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 135) ? '#0f172a' : '#ffffff';
};

/**
 * Virtual Keyboard component with Classic Touch tactile keys.
 * Preserves exact key rows, shift behavior, numeric toggling, enter and backspace.
 */
const VirtualKeyboard = ({ onKeyPress, onBackspace, onEnter, onClose }) => {
  const [isShift, setIsShift] = useState(false);
  const [isNumeric, setIsNumeric] = useState(false);

  const qwertyRows = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'],
    ['123', ' ', 'Enter']
  ];

  const numericRows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
    ['-', '_', '=', '+', '[', ']', '{', '}', ';', "'"],
    ['.', ',', '/', '?', ':', '"', '<', '>', '\\', '|'],
    ['ABC', ' ', 'Enter']
  ];

  const rows = isNumeric ? numericRows : qwertyRows;

  const handleKeyClick = (key) => {
    if (key === '⇧') {
      setIsShift(!isShift);
    } else if (key === '123') {
      setIsNumeric(true);
      setIsShift(false);
    } else if (key === 'ABC') {
      setIsNumeric(false);
      setIsShift(false);
    } else if (key === '⌫') {
      onBackspace();
    } else if (key === 'Enter') {
      onEnter();
    } else {
      let charToInsert = key;
      if (!isNumeric && isShift && key !== ' ') {
        charToInsert = key.toUpperCase();
        setIsShift(false); // auto revert to lowercase
      }
      onKeyPress(charToInsert);
    }
  };

  return (
    <div className="w-full max-w-xl md:max-w-2xl bg-[#1c2430] border-2 border-slate-700 rounded-xl p-2.5 md:p-3 shadow-2xl relative select-none">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-slate-800 text-amber-400 border border-slate-600 rounded-full font-black text-xs shadow hover:bg-slate-700 flex items-center justify-center sw-bevel cursor-pointer"
        >
          ✕
        </button>
      )}
      <div className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <div key={i} className={`flex justify-center gap-1 md:gap-1.5 ${i === 1 && !isNumeric ? 'px-3' : ''}`}>
            {row.map((key) => {
              const isAction = ['⇧', '⌫', '123', 'ABC'].includes(key);
              const isEnter = key === 'Enter';
              const isSpace = key === ' ';

              let btnClass = "min-h-[2.75rem] md:min-h-[3.25rem] py-2 px-1 md:px-2 rounded-lg font-bold shadow transition select-none flex items-center justify-center sw-bevel active:scale-95 text-sm md:text-base cursor-pointer ";

              if (isEnter) {
                btnClass += "bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white min-w-[4.5rem] md:min-w-[5.5rem] font-black";
              } else if (isAction) {
                btnClass += "bg-[#141b24] hover:bg-[#1a2330] text-amber-300 min-w-[3rem] md:min-w-[3.75rem] font-black border border-slate-700";
              } else if (isSpace) {
                btnClass += "bg-[#283344] hover:bg-[#344258] text-white flex-[3] text-sm";
              } else {
                btnClass += "bg-[#283344] hover:bg-[#344258] text-slate-100 flex-1 min-w-[2rem] md:min-w-[2.5rem]";
              }

              const displayKey = (!isNumeric && isShift && key.length === 1 && key >= 'a' && key <= 'z') ? key.toUpperCase() : key;

              return (
                <button
                  key={key}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleKeyClick(key); }}
                  className={btnClass}
                >
                  {displayKey}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const POS = () => {
  const [token, setToken] = useState(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (!t || t === 'null' || t === 'undefined') return null;
    try {
      const parsed = JSON.parse(u);
      if (parsed && (parsed.role === 'pos' || parsed.role === 'admin')) {
        return t;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      const parsed = JSON.parse(saved);
      return (parsed && (parsed.role === 'pos' || parsed.role === 'admin')) ? parsed : null;
    } catch {
      return null;
    }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [cart, setCart] = useState([]);
  const [cardId, setCardId] = useState('');
  const [status, setStatus] = useState({ msg: '', type: '' });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [keypadValue, setKeypadValue] = useState('0');
  const [openPriceValue, setOpenPriceValue] = useState('');
  const [openPriceConfirmed, setOpenPriceConfirmed] = useState(null);
  const [settings, setSettings] = useState({});
  const [receipt, setReceipt] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [activeField, setActiveField] = useState('username');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

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

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/categories`, { headers: { Authorization: `Bearer ${token}` } });
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Fallback: If categories request fails, POS keeps working with "Todos"
      setCategories([]);
    }
  }, [token]);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/settings`, { headers: { Authorization: `Bearer ${token}` } });
      setSettings(res.data);
    } catch {
      console.error('Falha ao carregar definições');
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const init = async () => {
      await fetchProducts();
      await fetchCategories();
      await fetchSettings();
    };
    init();
  }, [token, fetchProducts, fetchCategories, fetchSettings]);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
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

  const handleVirtualKeyPress = (key) => {
    if (activeField === 'username') setUsername(prev => prev + key);
    if (activeField === 'password') setPassword(prev => prev + key);
  };

  const handleVirtualBackspace = () => {
    if (activeField === 'username') setUsername(prev => prev.slice(0, -1));
    if (activeField === 'password') setPassword(prev => prev.slice(0, -1));
  };

  const handleVirtualEnter = () => {
    handleLogin();
  };

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && !error.config?.url?.endsWith('/auth/login')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [logout]);

  const OPEN_PRICE_MAX = 999999;

  const selectProduct = (p) => {
    setSelectedProduct(p);
    setKeypadValue('0');
    setOpenPriceValue('');
    setOpenPriceConfirmed(null);
  };

  const parsedOpenPrice = () => {
    const v = Number(openPriceValue);
    return (openPriceValue !== '' && Number.isFinite(v) && v > 0 && v <= OPEN_PRICE_MAX) ? Math.round(v * 100) / 100 : null;
  };

  const pressOpenPriceKey = (k) => {
    setOpenPriceValue(v => {
      if (k === '.') {
        if (v.includes('.')) return v;
        return v === '' ? '0.' : v + '.';
      }
      const [intPart, decPart] = v.split('.');
      if (decPart !== undefined) {
        return decPart.length >= 2 ? v : v + k;
      }
      if (intPart.length >= 6) return v;
      return (v === '0' ? '' : v) + k;
    });
  };

  const addToCart = (p, qty, unitPrice = null) => {
    const qtyToAdd = parseInt(qty);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) return;

    const isOpen = !!p.is_open_price;
    if (isOpen && (unitPrice === null || !(unitPrice > 0))) return;
    const lineKey = isOpen ? `${p.id}@${unitPrice}` : String(p.id);

    const existing = cart.find(item => item.lineKey === lineKey);
    const currentQtyInCart = existing ? existing.quantity : 0;
    const totalNewQty = currentQtyInCart + qtyToAdd;

    if (!isOpen && totalNewQty > p.stock_quantity) {
      setStatus({ msg: `Stock insuficiente para ${p.name}`, type: 'err' });
      return;
    }

    if (existing) {
      setCart(cart.map(i => i.lineKey === lineKey ? { ...i, quantity: totalNewQty } : i));
    } else {
      setCart([...cart, { ...p, price: isOpen ? unitPrice : p.price, lineKey, quantity: qtyToAdd }]);
    }

    setStatus({ msg: '', type: '' });
    setSelectedProduct(null);
  };

  const updateCartQty = (lineKey, delta) => {
    const line = cart.find(i => i.lineKey === lineKey);
    if (!line) return;
    const product = products.find(p => p.id === line.id);
    if (!product && !line.is_open_price) return;
    setCart(cart.map(item => {
      if (item.lineKey === lineKey) {
        const newQty = item.quantity + delta;
        if (newQty > 0 && (item.is_open_price || newQty <= product.stock_quantity)) {
          return { ...item, quantity: newQty };
        }
      }
      return item;
    }));
  };

  const checkout = async () => {
    if (processing) return;
    if (!cardId) { setStatus({ msg: 'Aproxime o cartão!', type: 'err' }); return; }
    setProcessing(true);
    try {
      const res = await axios.post(`${API_URL}/sales`, {
        card_id: cardId,
        items: cart.map(i => (i.is_open_price
          ? { product_id: i.id, quantity: i.quantity, unit_price: i.price }
          : { product_id: i.id, quantity: i.quantity }))
      }, { headers: { Authorization: `Bearer ${token}` } });

      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

      setReceipt({
        id: res.data.id,
        date: formattedDate,
        items: [...cart],
        total: res.data.total_charged,
        balance: res.data.remaining_balance,
        card_id: cardId
      });
      setIsMobileCartOpen(true);

      setStatus({ msg: 'Venda realizada!', type: 'ok' });
    } catch (err) {
      setStatus({ msg: err.response?.data?.error || 'Erro na venda', type: 'err' });
      if (err.response?.status === 401) logout();
    } finally {
      setProcessing(false);
    }
  };

  const maskCardId = (id) => {
    if (!id || id.length < 8) return "****";
    return `${id.substring(0, 4)}****${id.substring(id.length - 4)}`;
  };

  const handleNewSale = () => {
    setReceipt(null);
    setCart([]);
    setCardId('');
    setStatus({ msg: '', type: '' });
    setIsMobileCartOpen(false);
    fetchProducts();
    // Preserves selectedCategoryId as requested: "A categoria seleccionada mantém-se depois de Nova Venda"
  };

  // Category mapping and presence of uncategorized products
  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  const hasUncategorizedProducts = useMemo(() => {
    return products.some(p => !p.category_id || !categoryMap.has(p.category_id));
  }, [products, categoryMap]);

  // In-memory filtered products
  const filteredProducts = useMemo(() => {
    if (selectedCategoryId === 'all') {
      return products;
    }
    if (selectedCategoryId === 'others') {
      return products.filter(p => !p.category_id || !categoryMap.has(p.category_id));
    }
    return products.filter(p => p.category_id === selectedCategoryId);
  }, [products, selectedCategoryId, categoryMap]);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + ((item.price ?? 0) * item.quantity), 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // LOGIN SCREEN (Variante 2: Classic Touch style, compact form + keyboard always visible >= 600px height)
  if (!token) {
    return (
      <div className="min-h-screen w-full bg-[#1b222d] text-slate-100 flex flex-col items-center justify-center p-3 md:p-6 overflow-y-auto select-none">
        <div className="w-full max-w-xl flex flex-col items-center gap-3 md:gap-4 my-auto">
          
          {/* Compact Form */}
          <form onSubmit={handleLogin} className="w-full bg-[#242d3b] border-2 border-slate-700 rounded-xl p-4 md:p-6 shadow-2xl sw-bevel">
            <div className="flex items-center justify-between mb-3 border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow sw-bevel">
                  SW
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-black text-white tracking-wider uppercase">SMARTWALLET POS</h2>
                  <p className="text-[10px] text-amber-400 font-mono font-bold">TERMINAL DE AUTENTICAÇÃO INDUSTRIAL</p>
                </div>
              </div>
              <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-black/40 text-slate-300 font-mono">
                VERSÃO 2.4
              </span>
            </div>

            {error && (
              <div className="bg-red-950/80 border-2 border-red-500 text-red-200 p-2.5 rounded-lg mb-3 text-xs font-bold text-center">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] font-black text-slate-300 uppercase block mb-1">Utilizador</label>
                <input
                  type="text"
                  placeholder="Nome de utilizador"
                  className={`w-full p-3 bg-black/70 border-2 rounded-lg text-white font-bold text-sm outline-none transition ${activeField === 'username' ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-700'}`}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onFocus={() => setActiveField('username')}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-300 uppercase block mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Password"
                  className={`w-full p-3 bg-black/70 border-2 rounded-lg text-white font-bold text-sm outline-none transition ${activeField === 'password' ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-700'}`}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setActiveField('password')}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[3.5rem] bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-black text-base uppercase tracking-wider rounded-lg shadow-lg sw-bevel active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              ENTRAR NO TERMINAL
            </button>
          </form>

          {/* Integrated Virtual Keyboard */}
          <VirtualKeyboard
            onKeyPress={handleVirtualKeyPress}
            onBackspace={handleVirtualBackspace}
            onEnter={handleVirtualEnter}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen bg-[#242b38] text-slate-100 overflow-hidden font-sans select-none">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-print, #receipt-print * { visibility: visible !important; }
          #receipt-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 20px !important;
            font-family: 'Courier New', Courier, monospace !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* MAIN SECTION: Header + Categories Bar + Product Grid */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="min-h-[3.5rem] h-14 px-4 bg-gradient-to-r from-[#171c26] via-[#242c3b] to-[#171c26] border-b-2 border-slate-900 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 bg-amber-500 text-slate-950 font-black text-xs md:text-sm rounded shadow sw-bevel">
              POS 01
            </div>
            <div>
              <h1 className="font-black text-xs md:text-sm text-amber-400 uppercase tracking-widest leading-tight">
                {settings.installationName || 'SMARTWALLET POS'}
              </h1>
              <p className="text-[10px] text-slate-300 font-mono">
                OPERADOR: <span className="text-white font-bold">{user?.username || 'pos'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={logout}
              className="min-h-[2.5rem] px-3 md:px-4 py-1.5 bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase rounded sw-bevel flex items-center gap-1.5 cursor-pointer"
              title="Terminar Sessão"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">SAIR</span>
            </button>
          </div>
        </header>

        {/* Categories Bar (Scroll horizontal táctil, min 3.5rem height buttons, ordered) */}
        <div className="bg-[#1a202c] px-3 py-2 border-b-2 border-slate-900 flex items-center gap-2 touch-scroll-x shrink-0">
          
          {/* 1. Botão "Todos" */}
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`min-h-[3.5rem] h-14 px-5 rounded-lg font-black text-xs md:text-sm uppercase tracking-wide flex items-center gap-2 shrink-0 sw-bevel transition cursor-pointer ${selectedCategoryId === 'all' ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-300/60 border-2 border-white sw-bevel-active-amber' : 'bg-[#333e4f] text-slate-200 border border-slate-600 hover:bg-[#3d4a60]'}`}
          >
            ★ TODOS ({products.length})
          </button>

          {/* 2. Botões por categoria (ordenadas, cor sólida e contraste de texto calculado) */}
          {categories.map(cat => {
            const isSelected = selectedCategoryId === cat.id;
            const textColor = getContrastColor(cat.color);
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                style={{
                  backgroundColor: cat.color || '#3b82f6',
                  color: textColor
                }}
                className={`min-h-[3.5rem] h-14 px-5 rounded-lg font-black text-xs md:text-sm uppercase tracking-wide flex items-center gap-2 shrink-0 sw-bevel transition cursor-pointer ${isSelected ? 'ring-4 ring-white/90 border-2 border-slate-950 scale-[1.02] sw-bevel-active' : 'opacity-90 hover:opacity-100 border border-black/30'}`}
              >
                {isSelected && <span className="text-xs">✓</span>}
                {cat.name}
              </button>
            );
          })}

          {/* 3. Botão "Outros" (apenas se existirem produtos com category_id nulo ou sem categoria) */}
          {hasUncategorizedProducts && (
            <button
              onClick={() => setSelectedCategoryId('others')}
              className={`min-h-[3.5rem] h-14 px-5 rounded-lg font-black text-xs md:text-sm uppercase tracking-wide flex items-center gap-2 shrink-0 sw-bevel transition cursor-pointer ${selectedCategoryId === 'others' ? 'bg-slate-100 text-slate-950 ring-4 ring-white/80 border-2 border-slate-900 sw-bevel-active' : 'bg-[#4b5563] text-slate-200 border border-slate-600 hover:bg-[#5b6777]'}`}
            >
              OUTROS
            </button>
          )}
        </div>

        {/* Product Grid (Adaptável, scroll interno próprio, cartões táteis com marca da categoria) */}
        <div className="flex-1 p-3 md:p-4 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <p className="text-base font-bold uppercase mb-2">Nenhum produto nesta categoria</p>
              <button
                onClick={() => setSelectedCategoryId('all')}
                className="min-h-[3.5rem] px-6 bg-amber-500 text-slate-950 font-black text-xs uppercase rounded-lg sw-bevel cursor-pointer"
              >
                VER TODOS OS PRODUTOS
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(clamp(8.5rem,14vw,12rem),1fr))] gap-2.5 md:gap-3.5 pb-24 lg:pb-4">
              {filteredProducts.map(p => {
                const cat = p.category_id ? categoryMap.get(p.category_id) : null;
                const catColor = cat ? cat.color : '#64748b';
                const isOutOfStock = !p.is_open_price && p.stock_quantity <= 0;

                return (
                  <button
                    key={p.id}
                    disabled={isOutOfStock}
                    onClick={() => selectProduct(p)}
                    className={`bg-[#2e3747] hover:bg-[#394559] text-left flex flex-col justify-between rounded-lg p-2.5 border-2 border-slate-700/80 sw-bevel transition min-h-[11rem] relative overflow-hidden select-none ${isOutOfStock ? 'opacity-40 grayscale cursor-not-allowed border-slate-800' : 'cursor-pointer active:scale-[0.98]'}`}
                  >
                    {/* Faixa indicadora da categoria */}
                    <div
                      style={{ backgroundColor: catColor }}
                      className="absolute top-0 left-0 right-0 h-2"
                      title={cat ? cat.name : 'Sem categoria'}
                    />

                    {/* Imagem ou Placeholder */}
                    <div className="w-full h-20 md:h-24 bg-black/40 rounded mt-1.5 mb-2 overflow-hidden flex items-center justify-center border border-slate-700/50">
                      {p.image_base64 ? (
                        <img src={p.image_base64} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-[10px] font-black uppercase text-slate-400 text-center px-1">
                          {cat ? cat.name : 'SEM IMAGEM'}
                        </div>
                      )}
                    </div>

                    {/* Informações do Produto */}
                    <div className="flex-1 flex flex-col justify-between">
                      <h3 className="font-black text-xs md:text-sm text-slate-100 line-clamp-2 leading-tight mb-1">
                        {p.name}
                      </h3>

                      <div className="space-y-1">
                        <div className="bg-black/80 px-2 py-1 rounded border border-slate-700 flex justify-between items-center">
                          <span className="text-[9px] font-bold text-slate-400">PREÇO</span>
                          <span className="font-mono text-emerald-400 font-black text-xs md:text-sm">
                            {p.is_open_price ? 'LIVRE' : `${(p.price ?? 0).toFixed(2)} un.`}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className={isOutOfStock ? 'text-red-400' : 'text-slate-400'}>
                            {p.is_open_price ? 'PREÇO LIVRE' : (isOutOfStock ? 'ESGOTADO' : `STK: ${p.stock_quantity}`)}
                          </span>
                          {cat && (
                            <span
                              style={{ color: catColor }}
                              className="text-[9px] font-black uppercase truncate max-w-[4.5rem]"
                            >
                              {cat.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* BARRA INFERIOR RECOLHÍVEL PARA ECRÃS < 1024px (Tablets retrato/pequenos) */}
        <div className="lg:hidden shrink-0 bg-[#171c26] border-t-2 border-slate-900 p-2.5 flex items-center justify-between gap-2 shadow-2xl">
          <button
            onClick={() => setIsMobileCartOpen(!isMobileCartOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-[#232b38] rounded-lg border border-slate-700 sw-bevel flex-1 min-h-[3.5rem] cursor-pointer"
          >
            <ShoppingCart className="text-amber-400" size={20} />
            <div className="text-left flex-1 min-w-0">
              <p className="text-[11px] font-black uppercase text-slate-200">
                CARRINHO ({cartItemCount})
              </p>
              <p className="font-mono text-xs font-black text-amber-400 truncate">
                {cartTotal.toFixed(2)} un.
              </p>
            </div>
            {isMobileCartOpen ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>

          <button
            disabled={cart.length === 0 || processing}
            onClick={() => {
              if (!cardId) {
                setIsMobileCartOpen(true);
                setStatus({ msg: 'Insira ou aproxime o cartão!', type: 'err' });
              } else {
                checkout();
              }
            }}
            className="min-h-[3.5rem] px-4 bg-gradient-to-r from-emerald-600 to-green-700 disabled:bg-slate-700 disabled:opacity-50 text-white font-black text-xs md:text-sm uppercase rounded-lg sw-bevel flex items-center justify-center cursor-pointer"
          >
            {processing ? 'A processar...' : 'PAGAR AGORA'}
          </button>
        </div>

      </div>

      {/* PAINEL LATERAL (≥ 1024px) OU BOTTOM-SHEET (< 1024px) */}
      <div className={`
        fixed inset-0 z-40 lg:static lg:inset-auto
        ${isMobileCartOpen ? 'flex' : 'hidden lg:flex'}
        flex-col lg:w-[clamp(22rem,28vw,28rem)] bg-[#171c26] border-l-2 border-slate-900 shadow-2xl overflow-hidden shrink-0
      `}>
        
        {/* RECIBO APÓS VENDA */}
        {receipt ? (
          <div id="receipt-print" className="flex flex-col h-full bg-white text-black animate-in fade-in duration-200">
            <div className="p-6 md:p-8 flex-1 overflow-y-auto font-mono">
              <div className="text-center mb-6">
                <h2 className="text-xl md:text-2xl font-black uppercase mb-1 tracking-tight">
                  {settings.installationName || 'SmartWallet'}
                </h2>
                <p className="text-xs font-bold text-gray-600">{receipt.date}</p>
                <p className="text-xs font-bold text-gray-500 mt-1 uppercase">TRANSAÇÃO #{receipt.id}</p>
              </div>

              <div className="border-t-2 border-dashed border-gray-300 my-4"></div>

              <div className="space-y-2 mb-4 text-xs">
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start">
                    <div className="flex-1 pr-2">
                      <p className="font-bold">{item.name}</p>
                      <p className="text-[11px] text-gray-500">{item.quantity}x @ {(item.price ?? 0).toFixed(2)}</p>
                    </div>
                    <span className="font-black">{((item.quantity * (item.price ?? 0))).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-dashed border-gray-300 my-4"></div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold uppercase text-gray-600">TOTAL COMPRA:</span>
                  <span className="text-base font-black">{(receipt.total ?? 0).toFixed(2)} un.</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold uppercase text-gray-600">SALDO RESTANTE:</span>
                  <span className="text-sm font-black text-green-700">{(receipt.balance ?? 0).toFixed(2)} un.</span>
                </div>
              </div>

              <div className="border-t-2 border-dashed border-gray-300 my-4"></div>

              <div className="text-center">
                <p className="text-[11px] font-bold text-gray-600 uppercase mb-1">
                  CARTÃO: {maskCardId(receipt.card_id)}
                </p>
                <p className="text-sm font-black uppercase tracking-wider">OBRIGADO PELA SUA COMPRA</p>
              </div>
            </div>

            <div className="p-4 bg-gray-100 border-t border-gray-300 space-y-2.5 no-print">
              <button
                onClick={handleNewSale}
                className="w-full min-h-[3.5rem] bg-green-700 text-white font-black text-lg uppercase rounded-lg shadow sw-bevel active:scale-95 transition cursor-pointer"
              >
                NOVA VENDA
              </button>
              <button
                onClick={() => window.print()}
                className="w-full min-h-[3.5rem] bg-blue-700 text-white font-black text-base uppercase rounded-lg shadow sw-bevel active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer size={20} /> IMPRIMIR TALÃO
              </button>
            </div>
          </div>
        ) : (selectedProduct && selectedProduct.is_open_price && openPriceConfirmed === null) ? (

          /* ECRÃ DE PREÇO (produto de preço livre) */
          <div className="flex flex-col h-full bg-[#1e2532] animate-in fade-in duration-150">
            <div className="p-4 bg-[#141b24] border-b-2 border-slate-900 flex justify-between items-center">
              <div>
                <h2 className="text-sm md:text-base font-black text-amber-400 uppercase leading-tight">
                  {selectedProduct.name}
                </h2>
                <p className="text-xs text-slate-300 font-mono mt-0.5">PREÇO LIVRE • 1/2 INTRODUZIR PREÇO UNITÁRIO</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="min-h-[2.5rem] px-2.5 py-1 bg-slate-800 text-slate-300 hover:text-white rounded border border-slate-700 sw-bevel text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex flex-col items-center justify-center flex-1 space-y-4">
              <div className="w-full max-w-[280px]">
                <div className="p-4 rounded-lg border-2 text-center bg-black border-amber-600 shadow-inner">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    PREÇO UNITÁRIO (un.)
                  </p>
                  <span className="text-4xl md:text-5xl font-black font-mono text-amber-400 break-all">
                    {openPriceValue === '' ? '0' : openPriceValue}
                  </span>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">MÁX. {OPEN_PRICE_MAX.toLocaleString('pt-PT')} un.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 w-full max-w-[280px]">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map(k => (
                  <button
                    key={k}
                    onClick={() => pressOpenPriceKey(k)}
                    className="min-h-[3.5rem] h-14 bg-[#2b3545] hover:bg-[#384559] active:scale-90 text-amber-300 font-black text-2xl rounded-lg sw-bevel shadow flex items-center justify-center cursor-pointer"
                  >
                    {k}
                  </button>
                ))}
                <button
                  onClick={() => setOpenPriceValue(v => v.slice(0, -1))}
                  className="min-h-[3.5rem] h-14 bg-red-900/70 hover:bg-red-800 active:scale-90 text-red-200 font-black text-2xl rounded-lg sw-bevel shadow flex items-center justify-center cursor-pointer"
                >
                  ⌫
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#141b24] border-t-2 border-slate-900 space-y-2">
              <button
                disabled={parsedOpenPrice() === null}
                onClick={() => { setOpenPriceConfirmed(parsedOpenPrice()); setKeypadValue('0'); }}
                className="w-full min-h-[3.5rem] bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 disabled:bg-slate-700 disabled:opacity-40 text-white font-black text-lg uppercase rounded-lg sw-bevel transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check size={22} /> CONFIRMAR PREÇO
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-full min-h-[3.5rem] bg-[#2a3443] hover:bg-[#384559] text-slate-300 font-black text-sm uppercase rounded-lg sw-bevel transition active:scale-98 cursor-pointer"
              >
                CANCELAR
              </button>
            </div>
          </div>

        ) : selectedProduct ? (
          
          /* TECLADO DE QUANTIDADE (Variante 2: Classic Touch style) */
          <div className="flex flex-col h-full bg-[#1e2532] animate-in fade-in duration-150">
            {/* Header do Produto Selecionado */}
            <div className="p-4 bg-[#141b24] border-b-2 border-slate-900 flex justify-between items-center">
              <div>
                <h2 className="text-sm md:text-base font-black text-amber-400 uppercase leading-tight">
                  {selectedProduct.name}
                </h2>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  {selectedProduct.is_open_price
                    ? `PREÇO LIVRE: ${(openPriceConfirmed ?? 0).toFixed(2)} un. • 2/2 QUANTIDADE`
                    : `PREÇO: ${(selectedProduct.price ?? 0).toFixed(2)} un. • STK: ${selectedProduct.stock_quantity}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="min-h-[2.5rem] px-2.5 py-1 bg-slate-800 text-slate-300 hover:text-white rounded border border-slate-700 sw-bevel text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Display de Quantidade */}
            <div className="p-4 flex flex-col items-center justify-center flex-1 space-y-4">
              <div className="w-full max-w-[280px]">
                <div className={`p-4 rounded-lg border-2 text-center bg-black ${(!selectedProduct.is_open_price && parseInt(keypadValue) > selectedProduct.stock_quantity) ? 'border-red-500' : 'border-amber-600 shadow-inner'}`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    QUANTIDADE A REGISTAR
                  </p>
                  <span className={`text-5xl md:text-6xl font-black font-mono ${(!selectedProduct.is_open_price && parseInt(keypadValue) > selectedProduct.stock_quantity) ? 'text-red-500' : 'text-amber-400'}`}>
                    {keypadValue}
                  </span>
                  {(!selectedProduct.is_open_price && parseInt(keypadValue) > selectedProduct.stock_quantity) && (
                    <p className="text-xs text-red-400 font-bold mt-1 uppercase animate-pulse">
                      Excede Stock! (Max: {selectedProduct.stock_quantity})
                    </p>
                  )}
                </div>
              </div>

              {/* Botões do Teclado Numérico (Mínimo 3.5rem de altura) */}
              <div className="grid grid-cols-3 gap-2 w-full max-w-[280px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => (
                  <button
                    key={n}
                    onClick={() => setKeypadValue(v => (v === '0' ? n.toString() : v + n.toString()))}
                    className="min-h-[3.5rem] h-14 bg-[#2b3545] hover:bg-[#384559] active:scale-90 text-amber-300 font-black text-2xl rounded-lg sw-bevel shadow flex items-center justify-center cursor-pointer"
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setKeypadValue(v => v.length > 1 ? v.slice(0, -1) : '0')}
                  className="min-h-[3.5rem] h-14 bg-red-900/70 hover:bg-red-800 active:scale-90 text-red-200 font-black text-2xl rounded-lg sw-bevel shadow flex items-center justify-center col-span-2 cursor-pointer"
                >
                  ⌫
                </button>
              </div>
            </div>

            {/* Ações do Teclado */}
            <div className="p-4 bg-[#141b24] border-t-2 border-slate-900 space-y-2">
              <button
                disabled={!selectedProduct.is_open_price && (parseInt(keypadValue) || 1) > selectedProduct.stock_quantity}
                onClick={() => addToCart(selectedProduct, parseInt(keypadValue) || 1, selectedProduct.is_open_price ? openPriceConfirmed : null)}
                className="w-full min-h-[3.5rem] bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 disabled:bg-slate-700 disabled:opacity-40 text-white font-black text-lg uppercase rounded-lg sw-bevel transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check size={22} /> ADICIONAR
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-full min-h-[3.5rem] bg-[#2a3443] hover:bg-[#384559] text-slate-300 font-black text-sm uppercase rounded-lg sw-bevel transition active:scale-98 cursor-pointer"
              >
                CANCELAR
              </button>
            </div>
          </div>
        ) : (
          
          /* TALÃO CONTÍNUO / CARRINHO (Classic Touch style) */
          <>
            {/* Header do Talão */}
            <div className="p-3.5 bg-[#141822] border-b-2 border-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-amber-400" size={20} />
                <h2 className="font-black text-xs md:text-sm text-amber-400 uppercase tracking-widest">
                  TALÃO DE PEDIDO
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-[11px] font-bold text-slate-400 hover:text-red-400 px-2 py-1 rounded bg-[#202737] border border-slate-700 sw-bevel cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
                <button
                  onClick={() => setIsMobileCartOpen(false)}
                  className="lg:hidden text-slate-400 hover:text-white p-1 rounded bg-slate-800 sw-bevel cursor-pointer"
                  title="Recolher"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Lista Contínua de Artigos */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2 bg-[#202736]">
              {cart.length === 0 ? (
                <div className="text-slate-400 italic text-center text-xs py-16 font-mono">
                  [ Talão Vazio — Toque num produto para adicionar ]
                </div>
              ) : (
                cart.map(item => (
                  <div
                    key={item.lineKey}
                    className="p-2.5 bg-black/80 rounded border border-slate-700 font-mono text-xs space-y-1.5 shadow"
                  >
                    <div className="flex justify-between items-start text-slate-100">
                      <span className="font-black text-xs md:text-sm truncate flex-1 pr-2">
                        {item.name}
                      </span>
                      <button
                        onClick={() => setCart(cart.filter(i => i.lineKey !== item.lineKey))}
                        className="text-red-400 hover:text-red-300 font-black px-1.5 py-0.5 rounded hover:bg-red-950/60 cursor-pointer"
                        title="Remover"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-[11px] text-slate-400">
                        {item.quantity}x @ {(item.price ?? 0).toFixed(2)}
                      </span>
                      <span className="font-black text-amber-400 text-sm">
                        {(item.quantity * item.price).toFixed(2)} un.
                      </span>
                    </div>

                    {/* Controles de Quantidade (Alvos de toque mínimos) */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                      <button
                        onClick={() => updateCartQty(item.lineKey, -1)}
                        className="min-h-[2.5rem] min-w-[2.5rem] bg-[#2d3748] hover:bg-[#3d4a60] text-slate-100 font-black rounded sw-bevel flex items-center justify-center text-base cursor-pointer"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-black text-amber-300 text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQty(item.lineKey, 1)}
                        className="min-h-[2.5rem] min-w-[2.5rem] bg-[#2d3748] hover:bg-[#3d4a60] text-slate-100 font-black rounded sw-bevel flex items-center justify-center text-base cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Rodapé do Talão: Total LCD + UID Cartão + Botão PAGAR AGORA */}
            <div className="p-3.5 md:p-4 bg-[#141822] border-t-2 border-slate-900 space-y-3">
              
              {/* Display LCD do Total */}
              <div className="bg-black p-3 rounded border-2 border-amber-600 flex justify-between items-center shadow-inner">
                <span className="font-black text-xs text-amber-500 uppercase tracking-widest">
                  TOTAL PEDIDO:
                </span>
                <span className="font-mono text-2xl md:text-3xl font-black text-amber-400">
                  {cartTotal.toFixed(2)} <span className="text-xs text-amber-500">un.</span>
                </span>
              </div>

              {/* Campo Leitor de Cartão RFID */}
              <div className="relative">
                <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  type="text"
                  placeholder="UID DO CARTÃO RFID / NFC"
                  className="w-full min-h-[3.5rem] pl-11 pr-3 py-3 bg-black border-2 border-slate-700 rounded-lg text-emerald-400 font-mono text-xs md:text-sm font-bold uppercase focus:border-amber-500 outline-none transition"
                  value={cardId}
                  onChange={e => setCardId(e.target.value)}
                />
              </div>

              {/* Botão PAGAR AGORA (Mínimo 3.5rem de altura, verde vibrante com relevo tátil) */}
              <button
                disabled={cart.length === 0 || processing}
                onClick={checkout}
                className="w-full min-h-[3.5rem] h-14 md:h-16 bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 hover:from-emerald-500 hover:to-green-600 disabled:bg-slate-700 disabled:opacity-40 text-white font-black text-lg uppercase tracking-wider rounded-lg sw-bevel shadow-lg active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {processing ? 'A processar...' : 'PAGAR AGORA'}
              </button>

              {status.msg && (
                <div className={`p-3 rounded-lg text-center font-bold text-xs uppercase ${status.type === 'ok' ? 'bg-emerald-950 text-emerald-300 border border-emerald-600' : 'bg-red-950 text-red-300 border border-red-600'}`}>
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
