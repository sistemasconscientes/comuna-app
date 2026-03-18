import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { useSupplements } from '../hooks/useSupplements';
import { useStock } from '../hooks/useStock';
import { useUser } from '../context/UserContext';

export default function Stock() {
  const { user } = useUser();
  const { supplements } = useSupplements(user);
  const { data: stockData, updateQuantity, getLowStock } = useStock();
  const [editing, setEditing] = useState<Record<number, string>>({});

  const lowStock = getLowStock(7);

  const getStockEntry = (supplementId: number) =>
    stockData.find((s) => s.supplementId === supplementId);

  const handleSave = async (supplementId: number) => {
    const value = editing[supplementId];
    if (value === undefined) return;
    const qty = parseFloat(value);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Cantidad inválida');
      return;
    }
    await updateQuantity(supplementId, qty);
    setEditing((prev) => { const next = { ...prev }; delete next[supplementId]; return next; });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stock</Text>

      {lowStock.length > 0 && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>
            ⚠ Stock bajo: {lowStock.length} suplemento{lowStock.length > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <FlatList
        data={supplements}
        keyExtractor={(s) => s.notion_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowDose}>{item.dose}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.qty}>—</Text>
              <Text style={styles.qtyUnit}>stock (pendiente)</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  title: { fontSize: 24, fontWeight: '700', color: '#222', padding: 20, paddingBottom: 8 },
  alertBanner: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
  },
  alertText: { color: '#E65100', fontWeight: '500' },
  list: { padding: 20, gap: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '500', color: '#222' },
  rowDose: { fontSize: 13, color: '#888', marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  qty: { fontSize: 22, fontWeight: '700', color: '#222', textAlign: 'right' },
  qtyLow: { color: '#E53935' },
  qtyUnit: { fontSize: 11, color: '#aaa', textAlign: 'right' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 6,
    width: 70,
    textAlign: 'center',
    fontSize: 16,
    backgroundColor: '#fff',
  },
  saveBtn: { backgroundColor: '#81C784', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  saveBtnText: { color: '#fff', fontWeight: '600' },
});
