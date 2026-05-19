import React, { useState, useEffect } from 'react';
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
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const exportPDF = (headers, rows, filename) => {
  const doc = new jsPDF();
  doc.text('SmartWallet - Relatório', 14, 15);
  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 25,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 27, 75] }
  });
  doc.save(`${filename}.pdf`);
};

const downloadCSV = (data, filename) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

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
    { label: 'Cartões', icon: <CreditCard size={20}/>, path: '/cards', roles: ['admin', 'financeiro'] },
    { label: 'Relatórios', icon: <BarChart3 size={20}/>, path: '/reports', roles: ['admin', 'financeiro'] },
    { label: 'Logs', icon: <Search size={20}/>, path: '/logs', roles: ['admin'] },
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
  const [recon, setRecon] = React.useState(null);

  const fetchData = () => {
    const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    axios.get(`${API_URL}/reports/dashboard`, config).then(res => setData(res.data));
    axios.get(`${API_URL}/reports/reconciliation`, config).then(res => setRecon(res.data));
  };

  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!data || !recon) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded shadow-sm border-l-4 border-blue-600">
          <p className="text-xs uppercase text-gray-500 font-bold mb-1">Vendas Hoje</p>
          <p className="text-2xl font-bold">{(data.salesToday ?? 0).toFixed(2)}</p>
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

      <div className={`p-6 rounded-xl border flex items-center justify-between ${recon.isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
         <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${recon.isBalanced ? 'bg-green-500' : 'bg-red-500'} text-white`}>
               <CreditCard size={24} />
            </div>
            <div>
               <h3 className="font-black text-lg uppercase tracking-tighter">Reconciliação Financeira</h3>
               <p className="text-sm opacity-70">{recon.isBalanced ? 'O sistema está equilibrado.' : `Discrepância detectada no balanço de unidades.`}</p>
            </div>
         </div>
         <div className="text-right">
            <p className="text-xs font-bold uppercase opacity-50">Diferença</p>
            <p className={`text-3xl font-black ${recon.isBalanced ? 'text-green-600' : 'text-red-600'}`}>{(recon.discrepancy ?? 0).toFixed(2)} un.</p>
         </div>
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

  const exportCSV = () => {
    const data = users.map(u => ({
      username: u.username,
      role: u.role,
      full_name: u.full_name,
      is_active: u.is_active ? 'Sim' : 'Não'
    }));
    downloadCSV(data, 'utilizadores');
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button onClick={exportCSV} className="bg-green-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2 hover:bg-green-700 transition">
          <Download size={18} /> Exportar CSV
        </button>
      </div>
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
  const [form, setForm] = useState({ name: '', price: '', stock_quantity: 0, stock_minimum: 5, image_base64: '' });
  const [editingId, setEditingId] = useState(null);

  const fetchStock = () => {
    axios.get(`${API_URL}/products`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(res => setProducts(res.data));
  };
  React.useEffect(fetchStock, []);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande (máx 2MB)'); return; }
      const reader = new FileReader();
      reader.onloadend = () => setForm({ ...form, image_base64: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    const payload = { ...form, price: Number(form.price), stock_quantity: Number(form.stock_quantity), stock_minimum: Number(form.stock_minimum) };
    if (editingId) await axios.put(`${API_URL}/products/${editingId}`, payload, config);
    else await axios.post(`${API_URL}/products`, payload, config);
    setEditingId(null);
    setForm({ name: '', price: '', stock_quantity: 0, stock_minimum: 5, image_base64: '' });
    fetchStock();
  };

  const exportCSV = () => {
    const data = products.map(p => ({
      name: p.name,
      price: p.price,
      stock_quantity: p.stock_quantity,
      stock_minimum: p.stock_minimum
    }));
    downloadCSV(data, 'stock');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={exportCSV} className="bg-green-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2 hover:bg-green-700 transition">
          <Download size={18} /> Exportar CSV
        </button>
      </div>
      <form onSubmit={saveProduct} className="bg-white p-6 rounded shadow-sm border grid grid-cols-4 gap-4">
        <h3 className="col-span-4 font-bold border-b pb-2">{editingId ? 'Editar Produto' : 'Novo Produto'}</h3>
        <input placeholder="Nome" className="p-2 border rounded col-span-2" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
        <input placeholder="Preço (un.)" type="number" step="0.01" className="p-2 border rounded" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
        <input placeholder="Stock Inicial" type="number" className="p-2 border rounded" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: e.target.value})} required />
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-bold uppercase">Stock Mínimo (Alerta)</label>
          <input placeholder="Stock Mínimo" type="number" className="p-2 border rounded w-full" value={form.stock_minimum} onChange={e => setForm({...form, stock_minimum: e.target.value})} required />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-bold uppercase">Imagem do Produto</label>
          <input type="file" accept="image/*" onChange={handleImage} className="text-sm" />
        </div>
        {form.image_base64 && (
          <div className="col-span-4 flex items-center gap-4 bg-gray-50 p-2 rounded border border-dashed">
            <img src={form.image_base64} className="h-20 w-20 object-cover rounded shadow-sm bg-white" />
            <button type="button" onClick={() => setForm({...form, image_base64: ''})} className="text-red-500 text-xs font-bold hover:underline">Remover Imagem</button>
          </div>
        )}
        <button className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-bold col-span-4 transition shadow-md">
          {editingId ? 'Atualizar Produto' : 'Criar Produto'}
        </button>
        {editingId && <button type="button" onClick={() => {setEditingId(null); setForm({ name: '', price: '', stock_quantity: 0, stock_minimum: 5, image_base64: '' })}} className="col-span-4 text-gray-500 text-sm hover:underline">Cancelar Edição</button>}
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(p => (
          <div key={p.id} className="bg-white p-4 border rounded-xl shadow-sm flex gap-4 items-center hover:shadow-md transition">
            <div className="relative">
              {p.image_base64 ? <img src={p.image_base64} className="w-20 h-20 object-cover rounded-lg border" /> : <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 text-[10px] text-center px-1 font-bold">SEM IMAGEM</div>}
              {p.stock_quantity < p.stock_minimum && <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"><AlertTriangle size={12}/></div>}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-800 leading-tight">{p.name}</h4>
              <p className="text-blue-600 font-black">{Number(p.price).toFixed(2)} <span className="text-[10px] uppercase">un.</span></p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.stock_quantity < p.stock_minimum ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  Stock: {p.stock_quantity}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">Mín: {p.stock_minimum}</span>
              </div>
            </div>
            <button onClick={() => {setEditingId(p.id); setForm(p)}} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition"><Edit size={18}/></button>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Reports ---
const Reports = () => {
  const [tab, setTab] = useState('vendas_gerais');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', terminalId: '', productId: '', cardId: '', userId: '', entity: '' });
  const [terminals, setTerminals] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [entities, setEntities] = useState([]);
  const [cardData, setCardData] = useState(null);

  useEffect(() => {
    const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    axios.get(`${API_URL}/terminals`, config).then(res => setTerminals(res.data));
    axios.get(`${API_URL}/products`, config).then(res => setProducts(res.data));
    axios.get(`${API_URL}/users`, config).then(res => setUsers(res.data));
    axios.get(`${API_URL}/cards`, config).then(res => {
      const uniqueEntities = [...new Set(res.data.map(c => c.entity).filter(Boolean))];
      setEntities(uniqueEntities);
    });
  }, []);

  const fetchData = async () => {
    const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, params: filters };
    setLoading(true);
    try {
      let res;
      if (tab === 'vendas_gerais') res = await axios.get(`${API_URL}/reports/sales-general`, config);
      else if (tab === 'por_produto') res = await axios.get(`${API_URL}/reports/sales-by-product`, config);
      else if (tab === 'extrato_cartao') {
        if (!filters.cardId) { setData([]); setCardData(null); setLoading(false); return; }
        res = await axios.get(`${API_URL}/reports/card-statement`, config);
        setCardData(res.data.card);
        res.data = res.data.sales;
      }
      else if (tab === 'stock') res = await axios.get(`${API_URL}/products`, config);
      else if (tab === 'carregamentos') res = await axios.get(`${API_URL}/reports/recharges`, config);
      setData(res.data || []);
    } catch (e) { alert('Erro ao carregar dados'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tab]);

  const handleExportPDF = () => {
    let headers, rows;
    if (tab === 'vendas_gerais' || tab === 'extrato_cartao') {
      headers = ['Data', 'Produto', 'Terminal', 'UID Cartão', 'Entidade', 'Total (un.)'];
      rows = data.map(i => [new Date(i.timestamp).toLocaleString(), i.product_name, i.terminal_name || 'N/A', i.card_id, i.entity || '-', (i.total_price ?? 0).toFixed(2)]);
    } else if (tab === 'por_produto') {
      headers = ['Nome', 'Qtd Total Vendida', 'Total em Unidades'];
      rows = data.map(i => [i.name, i.quantity, (i.total ?? 0).toFixed(2)]);
    } else if (tab === 'stock') {
      headers = ['Nome', 'Preço', 'Stock Disponível', 'Stock Mínimo'];
      rows = data.map(i => [i.name, (i.price ?? 0).toFixed(2), i.stock_quantity, i.stock_minimum]);
    } else if (tab === 'carregamentos') {
      headers = ['Data/Hora', 'UID Cartão', 'Titular', 'Valor (un.)', 'Operador', 'Entidade'];
      rows = data.map(i => [new Date(i.timestamp).toLocaleString(), i.card_id, i.owner_name, (i.amount ?? 0).toFixed(2), i.username, i.entity || '-']);
    }
    exportPDF(headers, rows, tab);
  };

  const exportExcel = () => {
    let exportData;
    if (tab === 'vendas_gerais' || tab === 'extrato_cartao') {
      exportData = data.map(i => ({
        Data: new Date(i.timestamp).toLocaleString(),
        Produto: i.product_name,
        Terminal: i.terminal_name || 'N/A',
        'UID Cartão': i.card_id,
        Entidade: i.entity || '-',
        'Total (un.)': i.total_price
      }));
    } else if (tab === 'por_produto') {
      exportData = data.map(i => ({
        Nome: i.name,
        'Qtd Total Vendida': i.quantity,
        'Total em Unidades': i.total
      }));
    } else if (tab === 'stock') {
      exportData = data.map(i => ({
        Nome: i.name,
        Preço: i.price,
        'Stock Disponível': i.stock_quantity,
        'Stock Mínimo': i.stock_minimum
      }));
    } else if (tab === 'carregamentos') {
      exportData = data.map(i => ({
        'Data/Hora': new Date(i.timestamp).toLocaleString(),
        'UID Cartão': i.card_id,
        Titular: i.owner_name,
        'Valor (un.)': i.amount,
        Operador: i.username,
        Entidade: i.entity || '-'
      }));
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `${tab}.xlsx`);
  };

  const tabs = [
    { id: 'vendas_gerais', label: 'Vendas Gerais' },
    { id: 'por_produto', label: 'Por Produto' },
    { id: 'extrato_cartao', label: 'Extrato por Cartão' },
    { id: 'carregamentos', label: 'Carregamentos' },
    { id: 'stock', label: 'Stock' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`pb-2 px-4 font-bold whitespace-nowrap ${tab === t.id ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-500'}`}>{t.label}</button>
        ))}
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        {(tab !== 'stock') && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-gray-400">De</label>
              <input type="date" className="p-2 border rounded text-sm" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-gray-400">Até</label>
              <input type="date" className="p-2 border rounded text-sm" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} />
            </div>
          </>
        )}
        {tab === 'vendas_gerais' && (
          <>
            <select className="p-2 border rounded text-sm" value={filters.terminalId} onChange={e => setFilters({...filters, terminalId: e.target.value})}>
              <option value="">Todos Terminais</option>
              {terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="p-2 border rounded text-sm" value={filters.productId} onChange={e => setFilters({...filters, productId: e.target.value})}>
              <option value="">Todos Produtos</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>
        )}
        {tab === 'extrato_cartao' && (
          <input placeholder="UID do Cartão" className="p-2 border rounded text-sm" value={filters.cardId} onChange={e => setFilters({...filters, cardId: e.target.value})} />
        )}
        {tab === 'carregamentos' && (
          <>
            <select className="p-2 border rounded text-sm" value={filters.userId} onChange={e => setFilters({...filters, userId: e.target.value})}>
              <option value="">Todos Operadores</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <select className="p-2 border rounded text-sm" value={filters.entity} onChange={e => setFilters({...filters, entity: e.target.value})}>
              <option value="">Todas Entidades</option>
              {entities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
            </select>
          </>
        )}
        <div className="flex gap-2 col-span-1">
          <button onClick={fetchData} className="bg-blue-600 text-white p-2 rounded flex-1 font-bold text-sm">Filtrar</button>
          <button onClick={handleExportPDF} className="bg-red-600 text-white p-2 rounded flex-1 flex justify-center"><Download size={18}/></button>
          <button onClick={exportExcel} className="bg-green-600 text-white p-2 rounded flex-1 font-bold text-sm">XLS</button>
        </div>
      </div>

      {tab === 'extrato_cartao' && cardData && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex justify-between items-center">
           <div>
              <p className="text-xs text-blue-600 font-bold uppercase">Titular</p>
              <h3 className="text-xl font-black">{cardData.owner_name || 'Desconhecido'}</h3>
              <p className="text-[10px] font-bold text-blue-400 uppercase">{cardData.entity || '-'}</p>
           </div>
           <div className="text-right">
              <p className="text-xs text-blue-600 font-bold uppercase">Saldo Atual</p>
              <h3 className="text-2xl font-black text-blue-900">{(cardData.balance ?? 0).toFixed(2)} un.</h3>
           </div>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b uppercase text-[10px] font-black text-gray-500">
            {(tab === 'vendas_gerais' || tab === 'extrato_cartao') && (
              <tr><th className="p-4">Data/Hora</th><th className="p-4">Produto</th><th className="p-4">Terminal</th><th className="p-4">UID Cartão</th><th className="p-4">Entidade</th><th className="p-4 text-right">Total</th></tr>
            )}
            {tab === 'por_produto' && (
              <tr><th className="p-4">Nome do Produto</th><th className="p-4">Qtd Vendida</th><th className="p-4 text-right">Total (un.)</th></tr>
            )}
            {tab === 'stock' && (
              <tr><th className="p-4">Nome</th><th className="p-4">Preço</th><th className="p-4">Stock Disp.</th><th className="p-4">Stock Mín.</th></tr>
            )}
            {tab === 'carregamentos' && (
              <tr><th className="p-4">Data/Hora</th><th className="p-4">UID Cartão</th><th className="p-4">Titular</th><th className="p-4 text-right">Valor</th><th className="p-4">Operador</th><th className="p-4">Entidade</th></tr>
            )}
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="6" className="p-10 text-center italic text-gray-400">Carregando dados...</td></tr> : (
              data.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50 transition">
                  {(tab === 'vendas_gerais' || tab === 'extrato_cartao') && (
                    <>
                      <td className="p-4 whitespace-nowrap">{new Date(item.timestamp).toLocaleString()}</td>
                      <td className="p-4 font-bold">{item.product_name}</td>
                      <td className="p-4 text-gray-500">{item.terminal_name || 'Central'}</td>
                      <td className="p-4 font-mono text-[10px]">{item.card_id}</td>
                      <td className="p-4 text-[10px] font-bold text-gray-400">{item.entity || '-'}</td>
                      <td className="p-4 text-right font-black text-blue-600">{(item.total_price ?? 0).toFixed(2)}</td>
                    </>
                  )}
                  {tab === 'por_produto' && (
                    <>
                      <td className="p-4 font-bold">{item.name}</td>
                      <td className="p-4">{item.quantity}</td>
                      <td className="p-4 text-right font-black text-blue-600">{(item.total ?? 0).toFixed(2)}</td>
                    </>
                  )}
                  {tab === 'stock' && (
                    <>
                      <td className="p-4 font-bold">{item.name}</td>
                      <td className="p-4 font-medium text-gray-600">{(item.price ?? 0).toFixed(2)}</td>
                      <td className={`p-4 font-black ${item.stock_quantity < item.stock_minimum ? 'text-red-600' : 'text-green-600'}`}>{item.stock_quantity}</td>
                      <td className="p-4 text-gray-400 font-bold">{item.stock_minimum}</td>
                    </>
                  )}
                  {tab === 'carregamentos' && (
                    <>
                      <td className="p-4 whitespace-nowrap">{new Date(item.timestamp).toLocaleString()}</td>
                      <td className="p-4 font-mono text-[10px]">{item.card_id}</td>
                      <td className="p-4 font-bold">{item.owner_name}</td>
                      <td className="p-4 text-right font-black text-green-600">{(item.amount ?? 0).toFixed(2)}</td>
                      <td className="p-4 text-gray-600">{item.username}</td>
                      <td className="p-4 text-[10px] font-bold text-gray-400">{item.entity || '-'}</td>
                    </>
                  )}
                </tr>
              ))
            )}
            {!loading && data.length === 0 && (
              <tr><td colSpan="6" className="p-10 text-center italic text-gray-400">Nenhuns dados encontrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    axios.get(`${API_URL}/settings`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => { setConfig(res.data); setForm(res.data); });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    await axios.put(`${API_URL}/settings`, form, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    alert('Definições atualizadas!');
  };

  if (!config) return <div>Carregando...</div>;

  return (
    <form onSubmit={handleSave} className="bg-white p-8 border rounded-xl shadow-sm max-w-2xl space-y-6">
      <h3 className="text-xl font-black border-b pb-4">Definições do Sistema</h3>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-gray-400">Nome da Instalação</label>
          <input className="p-3 border rounded-lg font-bold" value={form.installationName} onChange={e => setForm({...form, installationName: e.target.value})} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-gray-400">Preço Base Cartão NFC (AOA)</label>
          <input type="number" className="p-3 border rounded-lg font-bold" value={form.nfcCardPrice} onChange={e => setForm({...form, nfcCardPrice: e.target.value})} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-gray-400">Stock Threshold Global</label>
          <input type="number" className="p-3 border rounded-lg font-bold" value={form.stockThreshold} onChange={e => setForm({...form, stockThreshold: e.target.value})} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-gray-400">Máximo Terminais POS (Somente Leitura)</label>
          <input className="p-3 border rounded-lg bg-gray-50 font-bold text-gray-400" value={form.maxPosTerminals} disabled />
        </div>
      </div>

      <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md">Guardar Alterações</button>
    </form>
  );
};

const AuditLogs = () => {
  const [data, setData] = useState({ logs: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', username: '', action: '' });

  const fetchLogs = async () => {
    const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, params: { ...filters, page } };
    const res = await axios.get(`${API_URL}/audit-logs`, config);
    setData(res.data);
  };

  useEffect(() => { fetchLogs(); }, [page]);

  const handleExportPDF = () => {
    const headers = ['Data', 'Utilizador', 'Acção', 'Entidade', 'Detalhes'];
    const rows = data.logs.map(l => [new Date(l.timestamp).toLocaleString(), l.username, l.action, l.entity, l.details]);
    exportPDF(headers, rows, 'audit_logs');
  };

  const exportExcel = () => {
    const exportData = data.logs.map(l => ({
      Data: new Date(l.timestamp).toLocaleString(),
      Utilizador: l.username,
      Acção: l.action,
      Entidade: l.entity,
      Detalhes: l.details
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs");
    XLSX.writeFile(wb, "audit_logs.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm border grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
         <input type="date" className="p-2 border rounded text-sm" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} />
         <input type="date" className="p-2 border rounded text-sm" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} />
         <input placeholder="Utilizador" className="p-2 border rounded text-sm" value={filters.username} onChange={e => setFilters({...filters, username: e.target.value})} />
         <input placeholder="Acção" className="p-2 border rounded text-sm" value={filters.action} onChange={e => setFilters({...filters, action: e.target.value})} />
         <div className="flex gap-2">
            <button onClick={() => { setPage(1); fetchLogs(); }} className="bg-blue-600 text-white p-2 rounded flex-1 font-bold">Filtrar</button>
            <button onClick={handleExportPDF} className="bg-red-600 text-white p-2 rounded flex-1 flex justify-center items-center"><Download size={18}/></button>
            <button onClick={exportExcel} className="bg-green-600 text-white p-2 rounded flex-1 font-bold text-sm">XLS</button>
         </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b text-[10px] font-black text-gray-500 uppercase">
            <tr><th className="p-4">Data/Hora</th><th className="p-4">Utilizador</th><th className="p-4">Acção</th><th className="p-4">Entidade</th><th className="p-4">Detalhes</th></tr>
          </thead>
          <tbody>
            {data.logs.map(l => (
              <tr key={l.id} className="border-b hover:bg-gray-50 transition">
                <td className="p-4 whitespace-nowrap text-xs">{new Date(l.timestamp).toLocaleString()}</td>
                <td className="p-4 font-bold">{l.username}</td>
                <td className="p-4"><span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-black">{l.action}</span></td>
                <td className="p-4 text-xs font-bold text-gray-400">{l.entity}</td>
                <td className="p-4 text-xs">{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center gap-2">
        {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => setPage(p)} className={`px-4 py-2 rounded font-bold ${page === p ? 'bg-blue-600 text-white' : 'bg-white border'}`}>{p}</button>
        ))}
      </div>
    </div>
  );
};

const CardsManagement = () => {
  const [tab, setTab] = useState('active');
  const [cards, setCards] = useState([]);
  const [filters, setFilters] = useState({ owner_name: '', is_active: '1', entity: '' });
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ id: '', owner_name: '', entity: '', price_paid: '' });
  const [recharge, setRecharge] = useState({ id: '', amount: '' });
  const [config, setConfig] = useState({});
  const [entities, setEntities] = useState([]);
  const [importData, setImportData] = useState({ valid: [], errors: [], results: null });

  useEffect(() => {
    const fetchConfig = async () => {
      const res = await axios.get(`${API_URL}/settings`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setConfig(res.data);
      setForm(f => ({ ...f, price_paid: res.data.nfcCardPrice }));
    };
    fetchConfig();
  }, []);

  const fetchCards = async () => {
    const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, params: filters };
    const res = await axios.get(`${API_URL}/cards`, config);
    setCards(res.data);
    const uniqueEntities = [...new Set(res.data.map(c => c.entity).filter(Boolean))];
    setEntities(uniqueEntities);
  };

  useEffect(() => { if (tab === 'active') fetchCards(); }, [tab, filters.is_active, filters.entity]);

  const filteredCards = cards.filter(card => {
    const matchTitular = card.owner_name?.toLowerCase().includes(search.toLowerCase()) ?? true;
    const matchEntity = !filters.entity || card.entity === filters.entity;
    const matchStatus = !filters.is_active ||
      (filters.is_active === '1' ? card.is_active === 1 : card.is_active === 0);
    return matchTitular && matchEntity && matchStatus;
  });

  const handleIssue = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/cards`, form, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      alert('Cartão emitido!');
      setForm({ id: '', owner_name: '', entity: '', price_paid: config.nfcCardPrice });
      setTab('active');
    } catch (err) { alert(err.response?.data?.error || 'Erro ao emitir'); }
  };

  const handleCancel = async (id) => {
    if (!confirm('Tem a certeza que deseja cancelar este cartão? O saldo será perdido.')) return;
    await axios.put(`${API_URL}/cards/${id}/cancel`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    fetchCards();
  };

  const handleRecharge = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/cards/recharge`, recharge, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      alert('Carregado!');
      setRecharge({ id: '', amount: '' });
      fetchCards();
    } catch (err) { alert('Erro no carregamento'); }
  };

  const exportCSV = () => {
    const data = filteredCards.map(c => ({
      uid: c.id,
      owner_name: c.owner_name,
      entity: c.entity,
      balance: c.balance,
      is_active: c.is_active ? 'Sim' : 'Não',
      created_at: new Date(c.created_at).toLocaleString(),
      price_paid: c.price_paid
    }));
    downloadCSV(data, 'cartoes');
  };

  const downloadTemplate = () => {
    const template = [{
      uid: '12345678',
      owner_name: 'João Silva',
      entity: 'Empresa A',
      balance: 100,
      price_paid: 500
    }];
    downloadCSV(template, 'template_cartoes');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const valid = [];
      const errors = [];
      const seenUids = new Set();
      const existingUids = new Set(cards.map(c => c.id));

      data.forEach((row, index) => {
        const line = index + 1;
        const { uid, owner_name, price_paid, balance, entity } = row;

        if (!uid || !owner_name || price_paid === undefined) {
          errors.push(`Linha ${line}: Campos obrigatórios em falta (uid, owner_name, price_paid).`);
          return;
        }

        if (seenUids.has(uid)) {
          errors.push(`Linha ${line}: UID duplicado no ficheiro (${uid}).`);
          return;
        }

        if (existingUids.has(uid)) {
          errors.push(`Linha ${line}: UID já existe no sistema (${uid}).`);
          return;
        }

        seenUids.add(uid);
        valid.push({
          uid: String(uid),
          owner_name: String(owner_name),
          entity: entity ? String(entity) : '',
          price_paid: Number(price_paid),
          balance: balance ? Number(balance) : 0
        });
      });

      setImportData({ valid, errors, results: null });
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = async () => {
    if (importData.valid.length === 0) return;
    try {
      const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      const res = await axios.post(`${API_URL}/cards/bulk-import`, { cards: importData.valid }, config);
      setImportData({ ...importData, results: res.data });
      fetchCards();
    } catch (err) {
      alert('Erro ao importar cartões.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b">
        <button onClick={() => setTab('active')} className={`pb-2 px-4 font-bold ${tab === 'active' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-500'}`}>Cartões Activos</button>
        <button onClick={() => setTab('issue')} className={`pb-2 px-4 font-bold ${tab === 'issue' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-500'}`}>Emissão de Cartão</button>
        <button onClick={() => setTab('import')} className={`pb-2 px-4 font-bold ${tab === 'import' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-500'}`}>Importação</button>
      </div>

      {tab === 'active' ? (
        <>
          <div className="flex justify-end -mb-2">
            <button onClick={exportCSV} className="bg-green-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2 hover:bg-green-700 transition">
              <Download size={18} /> Exportar CSV
            </button>
          </div>
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border flex gap-4">
               <input placeholder="Filtrar por titular..." className="p-2 border rounded flex-1" value={search} onChange={e => setSearch(e.target.value)} />
               <select className="p-2 border rounded" value={filters.entity} onChange={e => setFilters({...filters, entity: e.target.value})}>
                  <option value="">Todas Entidades</option>
                  {entities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
               </select>
               <select className="p-2 border rounded" value={filters.is_active} onChange={e => setFilters({...filters, is_active: e.target.value})}>
                  <option value="1">Activos</option>
                  <option value="0">Cancelados</option>
                  <option value="">Todos</option>
               </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border rounded-xl shadow-sm overflow-hidden">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b text-[10px] uppercase font-black text-gray-500">
                      <tr><th className="p-4">UID / Titular</th><th className="p-4">Entidade</th><th className="p-4">Saldo</th><th className="p-4">Criado em</th><th className="p-4">Estado</th><th className="p-4">Acções</th></tr>
                    </thead>
                    <tbody>
                      {filteredCards.map(c => (
                        <tr key={c.id} className="border-b hover:bg-gray-50 transition">
                          <td className="p-4">
                            <p className="font-mono text-[10px] text-gray-400">{c.id}</p>
                            <p className="font-bold">{c.owner_name || 'N/A'}</p>
                          </td>
                          <td className="p-4 text-xs font-bold text-gray-400">{c.entity || '-'}</td>
                          <td className="p-4 font-black text-blue-600">{(c.balance ?? 0).toFixed(2)}</td>
                          <td className="p-4 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                          <td className="p-4">
                             <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.is_active ? 'ACTIVO' : 'CANCELADO'}</span>
                          </td>
                          <td className="p-4">
                             <div className="flex gap-2">
                               <button onClick={() => setRecharge({...recharge, id: c.id})} className="text-blue-600 text-xs font-bold hover:underline">Carregar</button>
                               {c.is_active === 1 && <button onClick={() => handleCancel(c.id)} className="text-red-600 text-xs font-bold hover:underline">Cancelar</button>}
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
              </div>

              <form onSubmit={handleRecharge} className="bg-white p-6 border rounded-xl shadow-sm h-fit space-y-4">
                 <h3 className="font-black uppercase text-gray-400 text-xs border-b pb-2">Carregamento Rápido</h3>
                 <input placeholder="UID Cartão" className="w-full p-3 border rounded-lg bg-gray-50 font-mono" value={recharge.id} onChange={e => setRecharge({...recharge, id: e.target.value})} required />
                 <input placeholder="Valor (un.)" type="number" className="w-full p-3 border rounded-lg font-black text-xl text-blue-600" value={recharge.amount} onChange={e => setRecharge({...recharge, amount: e.target.value})} required />
                 <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">Confirmar Carregamento</button>
              </form>
            </div>
          </div>
        </>
      ) : tab === 'issue' ? (
        <form onSubmit={handleIssue} className="bg-white p-8 border rounded-xl shadow-sm max-w-lg mx-auto space-y-6">
           <div className="text-center border-b pb-4">
              <h3 className="text-2xl font-black text-blue-900">Emissão de Cartão</h3>
              <p className="text-gray-500 text-sm">Registe um novo cartão NFC no sistema</p>
           </div>
           <div className="space-y-4">
              <div className="flex flex-col gap-1">
                 <label className="text-xs font-bold uppercase text-gray-400">UID do Cartão (NFC)</label>
                 <input className="p-3 border rounded-lg font-mono" value={form.id} onChange={e => setForm({...form, id: e.target.value})} required />
              </div>
              <div className="flex flex-col gap-1">
                 <label className="text-xs font-bold uppercase text-gray-400">Nome do Titular</label>
                 <input className="p-3 border rounded-lg" value={form.owner_name} onChange={e => setForm({...form, owner_name: e.target.value})} required />
              </div>
              <div className="flex flex-col gap-1">
                 <label className="text-xs font-bold uppercase text-gray-400">Entidade</label>
                 <input className="p-3 border rounded-lg" value={form.entity} onChange={e => setForm({...form, entity: e.target.value})} placeholder="Ex: Logística, Empresa XYZ" />
              </div>
              <div className="flex flex-col gap-1">
                 <label className="text-xs font-bold uppercase text-gray-400">Preço Pago (AOA)</label>
                 <input type="number" className="p-3 border rounded-lg" value={form.price_paid} onChange={e => setForm({...form, price_paid: e.target.value})} required />
              </div>
           </div>
           <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg hover:bg-blue-700 transition shadow-lg">EMITIR CARTÃO</button>
        </form>
      ) : (
        <div className="bg-white p-8 border rounded-xl shadow-sm max-w-2xl mx-auto space-y-6">
           <div className="flex justify-between items-center border-b pb-4">
              <div>
                 <h3 className="text-2xl font-black text-blue-900">Importação em Massa</h3>
                 <p className="text-gray-500 text-sm">Carregue um ficheiro CSV para importar cartões</p>
              </div>
              <button onClick={downloadTemplate} className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1">
                 <Download size={14} /> Descarregar Template CSV
              </button>
           </div>

           <div className="space-y-4">
              <div className="p-10 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-4 hover:border-blue-400 transition cursor-pointer relative">
                 <input
                    type="file"
                    accept=".csv"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileUpload}
                 />
                 <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
                    <Plus size={32} />
                 </div>
                 <p className="font-bold text-gray-400">Clique para selecionar ou arraste o ficheiro CSV</p>
              </div>

              {(importData.valid.length > 0 || importData.errors.length > 0) && !importData.results && (
                 <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-gray-50 border grid grid-cols-2 gap-4">
                       <div className="text-center">
                          <p className="text-2xl font-black text-green-600">{importData.valid.length}</p>
                          <p className="text-xs font-bold uppercase text-gray-400">Válidos para importar</p>
                       </div>
                       <div className="text-center border-l">
                          <p className="text-2xl font-black text-red-600">{importData.errors.length}</p>
                          <p className="text-xs font-bold uppercase text-gray-400">Erros encontrados</p>
                       </div>
                    </div>

                    {importData.errors.length > 0 && (
                       <div className="max-h-40 overflow-y-auto p-3 bg-red-50 border border-red-100 rounded text-xs text-red-700 space-y-1">
                          <p className="font-bold mb-2 uppercase">Erros de Validação:</p>
                          {importData.errors.map((err, i) => <p key={i}>• {err}</p>)}
                       </div>
                    )}

                    <button
                       onClick={confirmImport}
                       disabled={importData.valid.length === 0}
                       className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md disabled:opacity-50"
                    >
                       Confirmar Importação ({importData.valid.length} cartões)
                    </button>
                 </div>
              )}

              {importData.results && (
                 <div className="space-y-4">
                    <div className="p-6 rounded-xl bg-blue-50 border-2 border-blue-200 text-center">
                       <h4 className="text-xl font-black text-blue-900 mb-2">Importação Concluída</h4>
                       <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="bg-white p-3 rounded shadow-sm">
                             <p className="text-2xl font-black text-green-600">{importData.results.success}</p>
                             <p className="text-[10px] font-bold uppercase text-gray-400">Sucesso</p>
                          </div>
                          <div className="bg-white p-3 rounded shadow-sm">
                             <p className="text-2xl font-black text-red-600">{importData.results.failed}</p>
                             <p className="text-[10px] font-bold uppercase text-gray-400">Falhas</p>
                          </div>
                       </div>
                    </div>

                    {importData.results.errors.length > 0 && (
                       <div className="max-h-40 overflow-y-auto p-3 bg-red-50 border border-red-100 rounded text-xs text-red-700 space-y-1">
                          <p className="font-bold mb-2 uppercase">Relatório de Falhas:</p>
                          {importData.results.errors.map((err, i) => <p key={i}>• UID {err.uid}: {err.error}</p>)}
                       </div>
                    )}

                    <button
                       onClick={() => setImportData({ valid: [], errors: [], results: null })}
                       className="w-full bg-gray-100 text-gray-600 py-2 rounded-lg font-bold hover:bg-gray-200 transition"
                    >
                       Limpar e Voltar
                    </button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
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
        <Route path="/cards" element={<ProtectedRoute allowedRoles={['admin', 'financeiro']}><Layout><CardsManagement /></Layout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin', 'financeiro']}><Layout><Reports /></Layout></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute allowedRoles={['admin']}><Layout><AuditLogs /></Layout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><Layout><SettingsPage /></Layout></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
