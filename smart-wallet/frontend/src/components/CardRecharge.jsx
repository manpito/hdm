import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

const CardRecharge = ({ token }) => {
  const [cardId, setCardId] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [cardInfo, setCardInfo] = useState(null);

  const handleSearch = async () => {
    try {
      const res = await axios.get(`${API_URL}/cards/${cardId}`);
      setCardInfo(res.data);
      setMessage('');
    } catch (err) {
      setCardInfo(null);
      setMessage('Não encontrado.');
    }
  };

  const handleRecharge = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/cards/recharge`, {
        id: cardId,
        amount: parseFloat(amount)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setCardInfo(res.data);
      setAmount('');
      setMessage('Sucesso!');
    } catch (err) {
      setMessage('Erro.');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Carregar Cartão</h2>
      <div className="flex gap-2 mb-4">
        <input type="text" className="flex-1 p-2 border rounded" value={cardId} onChange={(e) => setCardId(e.target.value)} placeholder="UID" />
        <button onClick={handleSearch} className="bg-gray-200 px-4 py-2 rounded">Buscar</button>
      </div>
      {cardInfo && <div className="mb-4 p-3 bg-blue-50">Saldo: {cardInfo.balance.toFixed(2)}</div>}
      <form onSubmit={handleRecharge}>
        <input type="number" className="w-full p-2 border rounded mb-4" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor" required />
        <button type="submit" className="w-full bg-green-600 text-white py-2 rounded font-bold">Carregar</button>
      </form>
      {message && <p className="mt-4 text-center">{message}</p>}
    </div>
  );
};

export default CardRecharge;
