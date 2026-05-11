import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, AlertTriangle, Calendar, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { API_URL } from '../config';

const ReportsDashboard = ({ token }) => {
  const [sales, setSales] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [consumption, setConsumption] = useState({ daily: [], weekly: [], monthly: [] });
  const [view, setView] = useState('daily');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const [s, st, c] = await Promise.all([
      axios.get(`${API_URL}/reports/sales`, config),
      axios.get(`${API_URL}/reports/low-stock`, config),
      axios.get(`${API_URL}/reports/consumption`, config)
    ]);
    setSales(s.data);
    setLowStock(st.data);
    setConsumption(c.data);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Relatorio SmartWallet', 14, 15);
    doc.autoTable({
      startY: 20,
      head: [['Data', 'Produto', 'Total']],
      body: sales.map(s => [new Date(s.timestamp).toLocaleString(), s.product_name, s.total_price.toFixed(2)]),
    });
    doc.save('vendas.pdf');
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(sales);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendas");
    XLSX.writeFile(wb, "vendas.xlsx");
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Relatórios</h2>
        <div className="flex gap-2">
          <button onClick={exportPDF} className="bg-red-600 text-white px-3 py-1 rounded text-xs">PDF</button>
          <button onClick={exportExcel} className="bg-green-600 text-white px-3 py-1 rounded text-xs">Excel</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-blue-50 border rounded text-center"><p className="text-xs text-blue-600 uppercase">Total</p><p className="text-2xl font-bold">{sales.reduce((a,b)=>a+b.total_price, 0).toFixed(2)}</p></div>
          <div className="p-4 bg-orange-50 border rounded text-center"><p className="text-xs text-orange-600 uppercase">Alertas</p><p className="text-2xl font-bold">{lowStock.length}</p></div>
          <div className="p-4 bg-green-50 border rounded text-center"><p className="text-xs text-green-600 uppercase">Hoje</p><p className="text-2xl font-bold">{consumption.daily[0]?.total.toFixed(2) || '0.00'}</p></div>
      </div>
      <div className="mb-8">
        <div className="flex gap-2 mb-4">
          {['daily', 'weekly', 'monthly'].map(t => <button key={t} onClick={() => setView(t)} className={`px-3 py-1 rounded text-sm ${view === t ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>{t}</button>)}
        </div>
        <div className="bg-white border rounded p-4">
          {consumption[view].map((item, i) => (
            <div key={i} className="flex justify-between py-2 border-b"><span>{item.period}</span><span className="font-bold">{item.total.toFixed(2)}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportsDashboard;
