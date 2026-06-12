import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Product } from '../types';

interface Props {
  product: Product;
  onPress: (product: Product) => void;
}

const ProductCard: React.FC<Props> = ({ product, onPress }) => {
  const isDisabled = product.stock_quantity <= 0;

  return (
    <TouchableOpacity
      onPress={() => onPress(product)}
      disabled={isDisabled}
      style={[styles.card, isDisabled && styles.disabled]}
    >
      {product.image_base64 ? (
        <Image source={{ uri: product.image_base64 }} style={styles.image} />
      ) : (
        <View style={styles.noImage}>
          <Text style={styles.noImageText}>SEM IMAGEM</Text>
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.price}>{(product.price ?? 0).toFixed(2)} un.</Text>
        <Text style={[styles.stock, isDisabled && styles.stockEmpty]}>
          STOCK: {product.stock_quantity}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 6,
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
  image: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  noImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: 'bold',
  },
  content: {
    padding: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
    height: 40,
  },
  price: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2563eb',
  },
  stock: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9ca3af',
    marginTop: 4,
  },
  stockEmpty: {
    color: '#ef4444',
  },
});

export default ProductCard;
