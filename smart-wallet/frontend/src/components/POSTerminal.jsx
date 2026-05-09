import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CreditCard, ShoppingCart } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

const POSTerminal = ({ token }) => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [cardId, setCardId] = useState('');
  const [status, setStatus] = useState({ message: '', type: '' });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const res = await axios.get(`${API_URL}/products`);
    setProducts(res.data);
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!cardId) {
      setStatus({ message: 'Aproxime o cartão.', type: 'error' });
      return;
    }
    if (cart.length === 0) return;

    try {
      const transactionData = {
        card_id: cardId,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity
        }))
      };

      await axios.post(`${API_URL}/transactions/bulk`, transactionData);

      setStatus({ message: 'Venda realizada!', type: 'success' });
      setCart([]);
      setCardId('');
      fetchProducts();
    } catch (err) {
      setStatus({
        message: err.response?.data?.error || 'Erro na venda.',
        type: 'error'
      });
    }
  };

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <h2 className="text-2xl font-bold mb-4">Terminal POS</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {products.map(p => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.stock_quantity <= 0}
              className={`p-4 border rounded shadow-sm text-left hover:bg-gray-50 flex flex-col justify-between ${p.stock_quantity <= 0 ? 'opacity-50 grayscale' : ''}`}
            >
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="text-sm text-gray-600">{p.price.toFixed(2)}</div>
              </div>
              <div className="text-xs mt-2 text-right">Stock: {p.stock_quantity}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 border rounded shadow-md h-fit">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <ShoppingCart size={24} /> Carrinho
        </h3>

        {cart.length === 0 ? (
          <p className="text-gray-500 italic">Vazio</p>
        ) : (
          <div className="space-y-3 mb-6">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <span>{item.quantity}x {item.name}</span>
                <div className="flex items-center gap-2">
                  <span>{(item.price * item.quantity).toFixed(2)}</span>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-500 font-bold">X</button>
                </div>
              </div>
            ))}
            <div className="border-t pt-2 font-bold flex justify-between">
              <span>Total:</span>
              <span>{cartTotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleCheckout}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Cartão (ID)</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              placeholder="UID"
            />
          </div>
          <button
            type="submit"
            disabled={cart.length === 0}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
          >
            Pagar
          </button>
        </form>

        {status.message && (
          <div className={`mt-4 p-3 rounded text-center text-sm font-medium ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default POSTerminal;
