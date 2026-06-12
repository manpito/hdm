import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USBPrinter, NetPrinter } from 'react-native-thermal-receipt-printer-image-qr';
import { maskCardId } from '../utils/maskCard';
import { buildReceiptLines } from '../utils/escpos';
import { PrinterConfig } from '../types';

const ReceiptScreen = ({ route, navigation }: any) => {
  const { receipt } = route.params;

  const handleNewSale = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'POS' }],
    });
  };

  const handlePrint = async () => {
    try {
      const configStr = await AsyncStorage.getItem('printer_config');
      if (!configStr) {
        Alert.alert('Impressora', 'Nenhuma impressora configurada. Configure em Definições.');
        return;
      }

      const config = JSON.parse(configStr) as PrinterConfig;
      if (config.type === 'none') {
        Alert.alert('Impressora', 'Nenhuma impressora configurada. Configure em Definições.');
        return;
      }

      const lines = buildReceiptLines(receipt);
      const textToPrint = lines.join('\n') + '\n\n\n\n';

      if (config.type === 'usb') {
        await USBPrinter.init();
        await USBPrinter.connectPrinter(config.deviceId);
        await USBPrinter.printRaw(textToPrint);
      } else if (config.type === 'network') {
        await NetPrinter.init();
        await NetPrinter.connectPrinter(config.host, config.port);
        await NetPrinter.printRaw(textToPrint);
      }
    } catch (err) {
      Alert.alert('Erro na Impressão', 'Certifique-se que a impressora está ligada e ligada ao dispositivo.');
      console.error(err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.receiptPaper}>
        <View style={styles.receiptContent}>
          <Text style={styles.installationName}>{receipt.installation_name}</Text>
          <Text style={styles.receiptDate}>{receipt.date}</Text>
          <Text style={styles.transactionId}>Transação: #{receipt.id}</Text>

          <View style={styles.divider} />

          {receipt.items.map((item: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemDetails}>
                  {item.quantity}x @ {(item.price ?? 0).toFixed(2)}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                {((item.quantity * (item.price ?? 0))).toFixed(2)}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL COMPRA</Text>
            <Text style={styles.totalValue}>{(receipt.total ?? 0).toFixed(2)} un.</Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>SALDO RESTANTE</Text>
            <Text style={[styles.totalValue, styles.balanceValue]}>
              {(receipt.balance ?? 0).toFixed(2)} un.
            </Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.cardInfo}>Cartão: {maskCardId(receipt.card_id)}</Text>
          <Text style={styles.thanks}>OBRIGADO PELA SUA COMPRA</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.newSaleBtn} onPress={handleNewSale}>
          <Text style={styles.newSaleBtnText}>NOVA VENDA</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
          <Text style={styles.printBtnText}>🖨️ IMPRIMIR</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  receiptPaper: {
    flex: 1,
    margin: 20,
    backgroundColor: 'white',
    elevation: 5,
    borderRadius: 4,
  },
  receiptContent: {
    padding: 25,
    alignItems: 'center',
  },
  installationName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1e3a5f',
    textTransform: 'uppercase',
    marginBottom: 5,
    textAlign: 'center',
  },
  receiptDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  transactionId: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  divider: {
    width: '100%',
    height: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    marginVertical: 20,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  itemDetails: {
    fontSize: 12,
    color: '#6b7280',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    fontFamily: 'monospace',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1e3a5f',
    fontFamily: 'monospace',
  },
  balanceValue: {
    color: '#10b981',
  },
  cardInfo: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  thanks: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e3a5f',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  newSaleBtn: {
    backgroundColor: '#10b981',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
  },
  newSaleBtnText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
  },
  printBtn: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  printBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
});

export default ReceiptScreen;
