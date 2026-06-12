import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CartItem as CartItemType } from '../types';

interface Props {
  item: CartItemType;
  onUpdateQty: (productId: number, delta: number) => void;
  onRemove: (productId: number) => void;
}

const CartItem: React.FC<Props> = ({ item, onUpdateQty, onRemove }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {item.quantity}x {item.name}
        </Text>
        <TouchableOpacity onPress={() => onRemove(item.id)}>
          <Text style={styles.removeText}>X</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.footer}>
        <View style={styles.qtyControls}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => onUpdateQty(item.id, -1)}>
            <Text style={styles.qtyBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => onUpdateQty(item.id, 1)}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.totalText}>
          {((item.quantity * (item.price ?? 0))).toFixed(2)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  removeText: {
    color: '#f87171',
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  qtyText: {
    paddingHorizontal: 12,
    fontWeight: '900',
    color: '#1e3a5f',
  },
  totalText: {
    fontWeight: 'bold',
    color: '#111827',
  },
});

export default CartItem;
