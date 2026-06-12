import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USBPrinter } from 'react-native-thermal-receipt-printer-image-qr';
import { PrinterConfig } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const PrinterSelector: React.FC<Props> = ({ visible, onClose }) => {
  const [selectedType, setSelectedType] = useState<'usb' | 'network' | 'none'>('none');
  const [usbDevices, setUsbDevices] = useState<any[]>([]);
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('9100');

  useEffect(() => {
    loadCurrentConfig();
  }, [visible]);

  const loadCurrentConfig = async () => {
    try {
      const configStr = await AsyncStorage.getItem('printer_config');
      if (configStr) {
        const config = JSON.parse(configStr) as PrinterConfig;
        setSelectedType(config.type);
        if (config.type === 'network') {
          setIp(config.host);
          setPort(config.port.toString());
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsbDevices = async () => {
    try {
      await USBPrinter.init();
      const devices = await USBPrinter.getDeviceList();
      setUsbDevices(devices);
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Falha ao listar dispositivos USB');
    }
  };

  const saveUsbConfig = async (device: any) => {
    const config: PrinterConfig = {
      type: 'usb',
      deviceId: device.device_id.toString(),
      deviceName: device.device_name
    };
    await AsyncStorage.setItem('printer_config', JSON.stringify(config));
    onClose();
  };

  const saveNetworkConfig = async () => {
    if (!ip) return Alert.alert('Erro', 'IP é obrigatório');
    const config: PrinterConfig = {
      type: 'network',
      host: ip,
      port: parseInt(port, 10) || 9100
    };
    await AsyncStorage.setItem('printer_config', JSON.stringify(config));
    onClose();
  };

  const saveNoneConfig = async () => {
    const config: PrinterConfig = { type: 'none' };
    await AsyncStorage.setItem('printer_config', JSON.stringify(config));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Configurar Impressora</Text>

          <View style={styles.tabs}>
            <TouchableOpacity
                style={[styles.tab, selectedType === 'usb' && styles.tabActive]}
                onPress={() => { setSelectedType('usb'); fetchUsbDevices(); }}
            >
              <Text style={[styles.tabText, selectedType === 'usb' && styles.tabTextActive]}>USB</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, selectedType === 'network' && styles.tabActive]}
                onPress={() => setSelectedType('network')}
            >
              <Text style={[styles.tabText, selectedType === 'network' && styles.tabTextActive]}>Rede</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, selectedType === 'none' && styles.tabActive]}
                onPress={() => setSelectedType('none')}
            >
              <Text style={[styles.tabText, selectedType === 'none' && styles.tabTextActive]}>Nenhuma</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {selectedType === 'usb' && (
              <View>
                <TouchableOpacity style={styles.refreshBtn} onPress={fetchUsbDevices}>
                    <Text style={styles.refreshBtnText}>Actualizar Lista</Text>
                </TouchableOpacity>
                {usbDevices.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum dispositivo encontrado</Text>
                ) : (
                  usbDevices.map((item, index) => (
                    <TouchableOpacity key={index} style={styles.deviceItem} onPress={() => saveUsbConfig(item)}>
                      <Text style={styles.deviceName}>{item.device_name}</Text>
                      <Text style={styles.deviceId}>ID: {item.device_id}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {selectedType === 'network' && (
              <View>
                <Text style={styles.label}>Endereço IP</Text>
                <TextInput
                    style={styles.input}
                    placeholder="ex: 192.168.1.100"
                    value={ip}
                    onChangeText={setIp}
                    keyboardType="numeric"
                />
                <Text style={styles.label}>Porta</Text>
                <TextInput
                    style={styles.input}
                    placeholder="9100"
                    value={port}
                    onChangeText={setPort}
                    keyboardType="numeric"
                />
                <TouchableOpacity style={styles.saveBtn} onPress={saveNetworkConfig}>
                    <Text style={styles.saveBtnText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedType === 'none' && (
              <View>
                <Text style={styles.emptyText}>Nenhuma impressora será utilizada.</Text>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#6b7280' }]} onPress={saveNoneConfig}>
                    <Text style={styles.saveBtnText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '70%',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1e3a5f',
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: 'white',
    elevation: 2,
  },
  tabText: {
    fontWeight: 'bold',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#2563eb',
  },
  content: {
    flex: 1,
  },
  deviceItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  deviceId: {
    fontSize: 12,
    color: '#9ca3af',
  },
  refreshBtn: {
    padding: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  refreshBtnText: {
    color: '#2563eb',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4b5563',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeBtn: {
    marginTop: 20,
    padding: 15,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#9ca3af',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#9ca3af',
    fontStyle: 'italic',
  }
});

export default PrinterSelector;
