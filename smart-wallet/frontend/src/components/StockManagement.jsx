import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

const StockManagement = ({ token }) => {
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock_quantity: '' });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const res = await axios.get(`${API_URL}/products`);
    setProducts(res.data);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    await axios.post(`${API_URL}/products`, {
      ...newProduct,
      price: parseFloat(newProduct.price),
      stock_quantity: parseInt(newProduct.stock_quantity)
    }, { headers: { Authorization: `Bearer ${token}` } });
    setNewProduct({ name: '', price: '', stock_quantity: '' });
    fetchProducts();
  };

  const handleDelete = async (id) => {
    await axios.delete(`${API_URL}/products/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    fetchProducts();
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Gestão de Stock</h2>
      <form onSubmit={handleAddProduct} className="mb-8 p-4 border rounded bg-gray-50 grid grid-cols-3 gap-4">
          <input type="text" placeholder="Nome" className="p-2 border rounded" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} required />
          <input type="number" step="0.01" placeholder="Preço" className="p-2 border rounded" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} required />
          <input type="number" placeholder="Qtd" className="p-2 border rounded" value={newProduct.stock_quantity} onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })} required />
          <button type="submit" className="col-span-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Adicionar</button>
      </form>
      <table className="min-w-full bg-white border">
          <thead><tr className="bg-gray-100"><th className="p-3 text-left">Nome</th><th className="p-3 text-left">Preço</th><th className="p-3 text-left">Stock</th><th className="p-3">Acções</th></tr></thead>
          <tbody>{products.map((p) => (
              <tr key={p.id}><td className="p-3 border">{p.name}</td><td className="p-3 border">{p.price.toFixed(2)}</td><td className="p-3 border">{p.stock_quantity}</td><td className="p-3 border"><button onClick={() => handleDelete(p.id)} className="text-red-600">Apagar</button></td></tr>
          ))}</tbody>
      </table>
    </div>
  );
};

export default StockManagement;
