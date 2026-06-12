import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  value: string;
  onPress: (num: string) => void;
  onDelete: () => void;
  maxStock: number;
}

const Keypad: React.FC<Props> = ({ value, onPress, onDelete, maxStock }) => {
  const isOverStock = parseInt(value, 10) > maxStock;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  return (
    <View style={styles.container}>
      <View style={[styles.display, isOverStock && styles.displayError]}>
        <Text style={styles.displayText}>Quantidade Seleccionada</Text>
        <Text style={[styles.valueText, isOverStock && styles.valueTextError]}>{value}</Text>
        {isOverStock && (
          <Text style={styles.errorText}>Excede Stock! (Max: {maxStock})</Text>
        )}
      </View>

      <View style={styles.grid}>
        {keys.map((key) => (
          <TouchableOpacity
            key={key}
            style={styles.key}
            onPress={() => onPress(key)}
          >
            <Text style={styles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.key, styles.deleteKey]}
          onPress={onDelete}
        >
          <Text style={styles.deleteKeyText}>⌫</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  display: {
    width: '100%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#dbeafe',
    alignItems: 'center',
    marginBottom: 20,
  },
  displayError: {
    borderColor: '#ef4444',
  },
  displayText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  valueText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#1e3a5f',
  },
  valueTextError: {
    color: '#dc2626',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 280,
  },
  key: {
    width: 80,
    height: 60,
    backgroundColor: 'white',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e3a5f',
  },
  deleteKey: {
    width: 170,
    backgroundColor: '#fef2f2',
    borderColor: '#fee2e2',
  },
  deleteKeyText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#dc2626',
  },
});

export default Keypad;
