import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Monitor,
  Package,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  AlertTriangle,
  ShoppingCart,
  Plus,
  Trash2,
  Edit,
  Download,
  Search
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from './config';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// --- Auth Guard ---
const ProtectedRoute = ({ children, allowedRoles }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) return <Navigate to="/login" />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
};

// --- Login Page ---
const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { username, password });
      if (res.data.user.role === 'pos') {
        setError('Apenas utilizadores administrativos podem aceder ao Backoffice.');
        return;
      }
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro no login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">SmartWallet Backoffice</h2>
        {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">{error}</div>}
        <input type="text" placeholder="Username" className="w-full p-2 border rounded mb-4" value={username} onChange={e => setUsername(e.target.value)} />
        <input type="password" placeholder="Password" className="w-full p-2 border rounded mb-4" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-blue-600 text-white py-2 rounded font-bold">Entrar</button>
      </form>
    </div>
  );
};

// --- Layout ---
const Layout = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20}/>, path: '/dashboard', roles: ['admin', 'financeiro'] },
    { label: 'Utilizadores', icon: <Users size={20}/>, path: '/users', roles: ['admin'] },
    { label: 'Terminais', icon: <Monitor size={20}/>, path: '/terminals', roles: ['admin'] },
    { label: 'Stock', icon: <Package size={20}/>, path: '/stock', roles: ['admin'] },
    { label: 'Cartões', icon: <CreditCard size={20}/>, path: '/recharge', roles: ['admin', 'financeiro'] },
    { label: 'Relatórios', icon: <BarChart3 size={20}/>, path: '/reports', roles: ['admin', 'financeiro'] },
    { label: 'Definições', icon: <Settings size={20}/>, path: '/settings', roles: ['admin'] },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800">
      <aside className="w-64 bg-blue-900 text-white flex flex-col">
        <div className="p-6 font-bold text-xl border-b border-blue-800">SmartWallet</div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.filter(item => item.roles.includes(user.role)).map(item => (
            <Link key={item.path} to={item.path} className="flex items-center gap-3 p-2 hover:bg-blue-800 rounded transition">
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        <button onClick={logout} className="p-4 border-t border-blue-800 flex items-center gap-3 hover:bg-red-900 transition">
          <LogOut size={20}/> Sair
        </button>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Backoffice</h1>
          <div className="text-sm font-medium bg-white px-4 py-2 rounded shadow-sm border">
            {user.full_name} ({user.role})
          </div>
        </header>
        {children}
      </main>
    </div>
  );
};

// --- Components (Mock/Simplified for demo brevity) ---
const Dashboard = () => {
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    axios.get(`${API_URL}/reports/dashboard`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => setData(res.data));
  }, []);

  if (!data) return <div>Carregando...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white p-6 rounded shadow-sm border-l-4 border-blue-600">
        <p className="text-xs uppercase text-gray-500 font-bold mb-1">Vendas Hoje</p>
        <p className="text-2xl font-bold">{data.salesToday.toFixed(2)}</p>
      </div>
      <div className="bg-white p-6 rounded shadow-sm border-l-4 border-orange-500">
        <p className="text-xs uppercase text-gray-500 font-bold mb-1">Alertas Stock</p>
        <p className="text-2xl font-bold">{data.lowStock}</p>
      </div>
      <div className="bg-white p-6 rounded shadow-sm border-l-4 border-green-500">
        <p className="text-xs uppercase text-gray-500 font-bold mb-1">POS Ativos</p>
        <p className="text-2xl font-bold">{data.activeTerminals}/{data.maxTerminals}</p>
      </div>
      <div className="bg-white p-6 rounded shadow-sm border-l-4 border-purple-500">
        <p className="text-xs uppercase text-gray-500 font-bold mb-1">Cartões Carregados</p>
        <p className="text-2xl font-bold">{data.rechargeToday}</p>
      </div>
    </div>
  );
};

// --- User Management ---
const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', role: 'pos', full_name: '', terminal_id: '', is_active: 1 });

  const fetchUsers = () => {
    const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    axios.get(`${API_URL}/users`, config).then(res => setUsers(res.data));
    axios.get(`${API_URL}/terminals`, config).then(res => setTerminals(res.data));
  };

  React.useEffect(fetchUsers, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    if (editing) {
      await axios.put(`${API_URL}/users/${editing}`, form, config);
    } else {
      await axios.post(`${API_URL}/users`, form, config);
    }
    setEditing(null);
    setForm({ username: '', password: '', role: 'pos', full_name: '', terminal_id: '', is_active: 1 });
    fetchUsers();
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-sm border grid grid-cols-2 gap-4">
        <h3 className="col-span-2 font-bold border-b pb-2 mb-2">{editing ? 'Editar Utilizador' : 'Novo Utilizador'}</h3>
        <input placeholder="Username" className="p-2 border rounded" value={form.username} onChange={e => setForm({...form, username: e.target.value})} disabled={editing} />
        <input placeholder="Password" type="password" className="p-2 border rounded" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
        <input placeholder="Nome Completo" className="p-2 border rounded" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
        <select className="p-2 border rounded" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
          <option value="admin">Admin</option>
          <option value="financeiro">Financeiro</option>
          <option value="pos">POS</option>
        </select>
        {form.role === 'pos' && (
          <select className="p-2 border rounded" value={form.terminal_id} onChange={e => setForm({...form, terminal_id: e.target.value})}>
            <option value="">Sem Terminal</option>
            {terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <div className="flex items-center gap-2">
           <input type="checkbox" checked={form.is_active === 1} onChange={e => setForm({...form, is_active: e.target.checked ? 1 : 0})} /> Ativo
        </div>
        <button className="bg-blue-600 text-white p-2 rounded font-bold col-span-2">{editing ? 'Guardar' : 'Criar'}</button>
      </form>

      <table className="w-full bg-white border rounded shadow-sm">
        <thead className="bg-gray-100 border-b">
          <tr>
            <th className="p-3 text-left">Username</th>
            <th className="p-3 text-left">Role</th>
            <th className="p-3 text-left">Estado</th>
            <th className="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-b hover:bg-gray-50">
              <td className="p-3">{u.username}</td>
              <td className="p-3"><span className="px-2 py-1 bg-gray-200 rounded text-xs uppercase">{u.role}</span></td>
              <td className="p-3">{u.is_active ? '✅ Ativo' : '❌ Inativo'}</td>
              <td className="p-3 text-right">
                <button onClick={() => {setEditing(u.id); setForm(u)}} className="text-blue-600 hover:underline">Editar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Terminal Management ---
const TerminalsManagement = () => {
  const [terminals, setTerminals] = useState([]);
  const [maxPos, setMaxPos] = useState(0);
  const [form, setForm] = useState({ name: '', location: '' });

  const fetchTerminals = () => {
    const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    axios.get(`${API_URL}/terminals`, config).then(res => setTerminals(res.data));
    axios.get(`${API_URL}/settings`, config).then(res => setMaxPos(res.data.maxPosTerminals));
  };

  React.useEffect(fetchTerminals, []);

  const handleToggle = async (id, currentState) => {
    try {
      await axios.put(`${API_URL}/terminals/${id}`, { is_active: currentState === 1 ? 0 : 1 }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      fetchTerminals();
    } catch (err) { alert(err.response.data.error); }
  };

  const activeCount = terminals.filter(t => t.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-blue-50 p-4 rounded border border-blue-200">
        <span className="font-bold">Limite de Terminais POS Ativos:</span>
        <span className={`px-4 py-1 rounded text-white font-bold ${activeCount >= maxPos ? 'bg-red-600' : 'bg-green-600'}`}>
          {activeCount} / {maxPos}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {terminals.map(t => (
          <div key={t.id} className="bg-white p-4 border rounded shadow-sm flex justify-between items-center">
            <div>
              <h4 className="font-bold">{t.name}</h4>
              <p className="text-sm text-gray-500">{t.location}</p>
            </div>
            <button
              onClick={() => handleToggle(t.id, t.is_active)}
              className={`px-3 py-1 rounded text-xs font-bold ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            >
              {t.is_active ? 'Ativo' : 'Desativado'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Stock Management ---
const StockManagement = () => {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: '', price: '', stock_quantity: 0, image_base64: '' });
  const [editingId, setEditingId] = useState(null);

  const fetchStock = () => {
    axios.get(`${API_URL}/products`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(res => setProducts(res.data));
  };
  React.useEffect(fetchStock, []);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setForm({ ...form, image_base64: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    if (editingId) await axios.put(`${API_URL}/products/${editingId}`, form, config);
    else await axios.post(`${API_URL}/products`, form, config);
    setEditingId(null);
    setForm({ name: '', price: '', stock_quantity: 0, image_base64: '' });
    fetchStock();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={saveProduct} className="bg-white p-6 rounded shadow-sm border grid grid-cols-3 gap-4">
        <input placeholder="Nome" className="p-2 border rounded" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input placeholder="Preço" type="number" step="0.1" className="p-2 border rounded" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
        <input placeholder="Stock" type="number" className="p-2 border rounded" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: e.target.value})} />
        <div className="col-span-3">
          <input type="file" onChange={handleImage} className="text-sm" />
          {form.image_base64 && <img src={form.image_base64} className="h-16 mt-2 rounded" />}
        </div>
        <button className="bg-blue-600 text-white p-2 rounded font-bold col-span-3">Guardar Produto</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {products.map(p => (
          <div key={p.id} className="bg-white p-4 border rounded shadow-sm flex gap-4">
            {p.image_base64 ? <img src={p.image_base64} className="w-16 h-16 object-cover rounded" /> : <div className="w-16 h-16 bg-gray-200 rounded"/>}
            <div className="flex-1">
              <h4 className="font-bold">{p.name}</h4>
              <p className="text-sm text-gray-500">{p.price} un.</p>
              <p className={`text-xs font-bold ${p.stock_quantity < 10 ? 'text-red-500' : 'text-green-500'}`}>Stock: {p.stock_quantity}</p>
            </div>
            <button onClick={() => {setEditingId(p.id); setForm(p)}} className="text-blue-600"><Edit size={16}/></button>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Reports ---
const Reports = () => {
  const [tab, setTab] = useState('general');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    setLoading(true);
    const endpoints = { general: 'sales-general', products: 'sales-by-product', stock: '../products' };
    axios.get(`${API_URL}/reports/${endpoints[tab]}`, config)
      .then(res => { setData(res.data); setLoading(false); });
  }, [tab]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Relatorio SmartWallet - ${tab}`, 14, 15);
    const headers = tab === 'products' ? [['Nome', 'Qtd', 'Total']] : tab === 'stock' ? [['Nome', 'Preço', 'Stock']] : [['Data', 'Produto', 'Terminal', 'Total']];
    const body = tab === 'products' ? data.map(i => [i.name, i.quantity, i.total]) : tab === 'stock' ? data.map(i => [i.name, i.price, i.stock_quantity]) : data.map(i => [new Date(i.timestamp).toLocaleString(), i.product_name, i.terminal_name, i.total_price]);
    doc.autoTable({ startY: 20, head: headers, body: body });
    doc.save(`${tab}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b">
        {['general', 'products', 'stock'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`pb-2 px-4 font-bold capitalize ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>{t}</button>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={exportPDF} className="flex items-center gap-1 bg-red-600 text-white px-3 py-1 rounded text-sm"><Download size={14}/> PDF</button>
      </div>
      <div className="bg-white border rounded shadow-sm p-4">
         {loading ? 'Carregando...' : <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>}
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    axios.get(`${API_URL}/settings`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(res => setConfig(res.data));
  }, []);
  if (!config) return <div>Carregando...</div>;
  return (
    <div className="bg-white p-6 border rounded shadow-sm max-w-lg space-y-4">
      <div><label className="text-sm text-gray-500">Nome da Instalação</label><p className="font-bold">{config.installationName}</p></div>
      <div><label className="text-sm text-gray-500">Threshold Alerta Stock</label><p className="font-bold">{config.stockThreshold}</p></div>
      <div><label className="text-sm text-gray-500">Limite Terminais POS (MAX_POS_TERMINALS)</label><p className="font-bold text-blue-600">{config.maxPosTerminals}</p></div>
    </div>
  );
};

const CardRecharge = () => {
  const [cardId, setCardId] = useState('');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');

  const handleRecharge = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/cards/recharge`, { id: cardId, amount: Number(amount) }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setMsg('Carregado com sucesso!');
      setCardId(''); setAmount('');
    } catch (err) { setMsg('Erro no carregamento'); }
  };

  return (
    <form onSubmit={handleRecharge} className="bg-white p-6 border rounded shadow-sm max-w-md space-y-4">
      <h3 className="font-bold">Carregamento de Cartão</h3>
      {msg && <div className="p-2 bg-blue-50 text-blue-700 text-sm">{msg}</div>}
      <input placeholder="ID Cartão (NFC)" className="w-full p-2 border rounded" value={cardId} onChange={e => setCardId(e.target.value)} required />
      <input placeholder="Valor em Unidades" type="number" className="w-full p-2 border rounded" value={amount} onChange={e => setAmount(e.target.value)} required />
      <button className="w-full bg-blue-600 text-white py-2 rounded font-bold">Carregar</button>
    </form>
  );
};

// --- App Root ---
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'financeiro']}><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><Layout><UsersManagement /></Layout></ProtectedRoute>} />
        <Route path="/terminals" element={<ProtectedRoute allowedRoles={['admin']}><Layout><TerminalsManagement /></Layout></ProtectedRoute>} />
        <Route path="/stock" element={<ProtectedRoute allowedRoles={['admin']}><Layout><StockManagement /></Layout></ProtectedRoute>} />
        <Route path="/recharge" element={<ProtectedRoute allowedRoles={['admin', 'financeiro']}><Layout><CardRecharge /></Layout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin', 'financeiro']}><Layout><Reports /></Layout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><Layout><SettingsPage /></Layout></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
