import React, { useState, useEffect } from 'react';
import StockManagement from './components/StockManagement';
import CardRecharge from './components/CardRecharge';
import POSTerminal from './components/POSTerminal';
import ReportsDashboard from './components/ReportsDashboard';
import Login from './components/Login';
import { ShoppingCart, CreditCard, Package, LayoutDashboard, LogOut } from 'lucide-react';

function App() {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('sw-auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [tab, setTab] = useState('pos');

  useEffect(() => {
    if (auth) localStorage.setItem('sw-auth', JSON.stringify(auth));
    else localStorage.removeItem('sw-auth');
  }, [auth]);

  if (!auth) return <Login onLogin={setAuth} />;

  const isAdmin = auth.user.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-800 text-white p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold flex items-center gap-2"><CreditCard /> SmartWallet</h1>
        <nav className="flex gap-4 text-sm">
          <button onClick={() => setTab('pos')} className={tab === 'pos' ? 'underline' : ''}>POS</button>
          {isAdmin && (
            <>
              <button onClick={() => setTab('stock')} className={tab === 'stock' ? 'underline' : ''}>Stock</button>
              <button onClick={() => setTab('cards')} className={tab === 'cards' ? 'underline' : ''}>Cartão</button>
              <button onClick={() => setTab('reports')} className={tab === 'reports' ? 'underline' : ''}>Relatórios</button>
            </>
          )}
        </nav>
        <button onClick={() => setAuth(null)} className="flex items-center gap-1 text-sm bg-red-700 px-2 py-1 rounded"><LogOut size={16}/> Sair</button>
      </header>
      <main className="container mx-auto p-4 bg-white mt-4 shadow rounded min-h-[80vh]">
        {tab === 'pos' && <POSTerminal token={auth.token} />}
        {tab === 'stock' && isAdmin && <StockManagement token={auth.token} />}
        {tab === 'cards' && isAdmin && <CardRecharge token={auth.token} />}
        {tab === 'reports' && isAdmin && <ReportsDashboard token={auth.token} />}
      </main>
    </div>
  );
}

export default App;
