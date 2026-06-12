import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TextInput, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { Product, CartItem as CartItemType, Settings, Receipt } from '../types';
import ProductCard from '../components/ProductCard';
import CartItem from '../components/CartItem';
import Keypad from '../components/Keypad';
import PrinterSelector from '../components/PrinterSelector';

const POSScreen = ({ navigation }: any) => {
  const [token, setToken] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItemType[]>([]);
  const [cardId, setCardId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [keypadValue, setKeypadValue] = useState('1');
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    navigation.replace('Login');
  }, [navigation]);

  const fetchData = useCallback(async (authToken: string) => {
    try {
      const [prodRes, setRes] = await Promise.all([
        axios.get(`${API_URL}/products`, { headers: { Authorization: `Bearer ${authToken}` } }),
        axios.get(`${API_URL}/settings`, { headers: { Authorization: `Bearer ${authToken}` } }).catch(() => ({ data: {} }))
      ]);
      setProducts(prodRes.data);
      setSettings(setRes.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
      } else {
        Alert.alert('Erro', 'Falha ao carregar dados');
      }
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const init = async () => {
      const savedToken = await AsyncStorage.getItem('token');
      if (!savedToken) {
        logout();
        return;
      }
      setToken(savedToken);
      fetchData(savedToken);
    };
    init();

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
  }, [logout, fetchData]);

  const addToCart = () => {
    if (!selectedProduct) return;
    const qty = parseInt(keypadValue, 10);
    if (isNaN(qty) || qty <= 0) return;

    if (qty > selectedProduct.stock_quantity) {
      Alert.alert('Stock insuficiente', `Max: ${selectedProduct.stock_quantity}`);
      return;
    }

    const existing = cart.find(item => item.id === selectedProduct.id);
    const currentQtyInCart = existing ? existing.quantity : 0;
    const totalNewQty = currentQtyInCart + qty;

    if (totalNewQty > selectedProduct.stock_quantity) {
        Alert.alert('Stock insuficiente', `Stock total excedido (ja tem ${currentQtyInCart} no carrinho)`);
        return;
    }

    if (existing) {
      setCart(cart.map(i => i.id === selectedProduct.id ? { ...i, quantity: totalNewQty } : i));
    } else {
      setCart([...cart, { ...selectedProduct, quantity: qty }]);
    }

    setSelectedProduct(null);
    setKeypadValue('1');
  };

  const updateCartQty = (productId: number, delta: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

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

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const handleCheckout = async () => {
    if (!cardId) {
      Alert.alert('Erro', 'Por favor, insira o UID do Cartão');
      return;
    }
    if (cart.length === 0) return;

    try {
      const res = await axios.post(`${API_URL}/sales`, {
        card_id: cardId,
        items: cart.map(i => ({ product_id: i.id, quantity: i.quantity }))
      }, { headers: { Authorization: `Bearer ${token}` } });

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

      const receipt: Receipt = {
        id: res.data.id,
        date: formattedDate,
        items: [...cart],
        total: cart.reduce((a, b) => a + ((b.price ?? 0) * b.quantity), 0),
        balance: res.data.remaining_balance,
        card_id: cardId,
        installation_name: settings.installationName || 'SmartWallet'
      };

      navigation.navigate('Receipt', { receipt });
    } catch (err: any) {
      Alert.alert('Erro na venda', err.response?.data?.error || 'Erro desconhecido');
    }
  };

  const total = cart.reduce((a, b) => a + ((b.price ?? 0) * b.quantity), 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TERMINAL DE VENDAS</Text>
        <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setPrinterModalVisible(true)} style={styles.iconButton}>
                <Text style={styles.iconText}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={logout} style={styles.iconButton}>
                <Text style={[styles.iconText, { color: '#ef4444' }]}>🚪</Text>
            </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mainContent}>
        {selectedProduct ? (
          <View style={styles.keypadOverlay}>
            <View style={styles.keypadHeader}>
                <Text style={styles.keypadTitle}>{selectedProduct.name}</Text>
                <Text style={styles.keypadSubtitle}>Preço Unitário: {(selectedProduct.price ?? 0).toFixed(2)}</Text>
            </View>
            <ScrollView contentContainerStyle={styles.keypadBody}>
                <Keypad
                    value={keypadValue}
                    onPress={(num) => setKeypadValue(v => (v === '1' && num !== '0') ? num : (v === '0' ? num : v + num))}
                    onDelete={() => setKeypadValue(v => v.length > 1 ? v.slice(0, -1) : '1')}
                    maxStock={selectedProduct.stock_quantity}
                />
            </ScrollView>
            <View style={styles.keypadFooter}>
                <TouchableOpacity
                    style={[styles.confirmBtn, parseInt(keypadValue, 10) > selectedProduct.stock_quantity && styles.disabledBtn]}
                    onPress={addToCart}
                    disabled={parseInt(keypadValue, 10) > selectedProduct.stock_quantity || parseInt(keypadValue, 10) === 0}
                >
                    <Text style={styles.confirmBtnText}>✓ ADICIONAR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedProduct(null)}>
                    <Text style={styles.cancelBtnText}>CANCELAR</Text>
                </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.productsSection}>
              {loading ? (
                <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 50 }} />
              ) : (
                <FlatList
                  data={products}
                  keyExtractor={(item) => item.id.toString()}
                  numColumns={2}
                  renderItem={({ item }) => (
                    <ProductCard product={item} onPress={setSelectedProduct} />
                  )}
                  contentContainerStyle={styles.productList}
                />
              )}
            </View>

            <View style={styles.cartSection}>
              <View style={styles.cartHeader}>
                  <Text style={styles.cartTitle}>CARRINHO</Text>
              </View>

              <ScrollView style={styles.cartItems}>
                {cart.length === 0 ? (
                  <Text style={styles.emptyCart}>Carrinho vazio</Text>
                ) : (
                  cart.map((item) => (
                    <CartItem
                        key={item.id}
                        item={item}
                        onUpdateQty={updateCartQty}
                        onRemove={removeFromCart}
                    />
                  ))
                )}
              </ScrollView>

              <View style={styles.cartFooter}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
                    <Text style={styles.totalValue}>{total.toFixed(2)} un.</Text>
                </View>

                <TextInput
                  style={styles.cardInput}
                  placeholder="UID do Cartão"
                  value={cardId}
                  onChangeText={setCardId}
                />

                <TouchableOpacity
                    style={[styles.payBtn, cart.length === 0 && styles.disabledBtn]}
                    onPress={handleCheckout}
                    disabled={cart.length === 0}
                >
                  <Text style={styles.payBtnText}>PAGAR AGORA</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>

      <PrinterSelector
        visible={printerModalVisible}
        onClose={() => setPrinterModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    height: 60,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e3a5f',
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 15,
    padding: 5,
  },
  iconText: {
    fontSize: 20,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'column',
  },
  productsSection: {
    flex: 1,
  },
  productList: {
    padding: 10,
  },
  cartSection: {
    height: 350,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    elevation: 20,
  },
  cartHeader: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cartTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1e3a5f',
    textAlign: 'center',
  },
  cartItems: {
    flex: 1,
    padding: 10,
  },
  emptyCart: {
    textAlign: 'center',
    marginTop: 40,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  cartFooter: {
    padding: 15,
    backgroundColor: '#f9fafb',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e3a5f',
  },
  cardInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  payBtn: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  payBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
  },
  disabledBtn: {
    backgroundColor: '#d1d5db',
  },
  keypadOverlay: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  keypadHeader: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  keypadTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1e3a5f',
    marginBottom: 4,
  },
  keypadSubtitle: {
    color: '#6b7280',
    fontWeight: 'bold',
  },
  keypadBody: {
    padding: 20,
    alignItems: 'center',
  },
  keypadFooter: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  confirmBtn: {
    backgroundColor: '#10b981',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
  },
  cancelBtn: {
    backgroundColor: '#f3f4f6',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '900',
  },
});

export default POSScreen;
