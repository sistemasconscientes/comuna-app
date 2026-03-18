import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { markForRestock } from '../api/notion';
import { useSupplements } from '../hooks/useSupplements';
import { useStock } from '../hooks/useStock';
import type { Supplement, StockEntry } from '../types';

type User = 'diana' | 'estefania';

interface Props {
  user: User;
}

interface DaysInfo {
  daysRemaining: number | null;
  pillsRemaining: number | null;
}

function calcDays(entry: StockEntry): DaysInfo {
  if (!entry.bottleOpenedAt || entry.totalPills == null || entry.pillsPerDay == null) {
    return { daysRemaining: null, pillsRemaining: null };
  }
  const bottleOpenedAt = new Date(entry.bottleOpenedAt);
  const daysSinceOpened = Math.floor(
    (Date.now() - bottleOpenedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const pillsRemaining = entry.totalPills - daysSinceOpened * entry.pillsPerDay;
  const daysRemaining = Math.floor(pillsRemaining / entry.pillsPerDay);
  return { daysRemaining, pillsRemaining };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface EditState {
  supplement: Supplement;
  localId: number;
  bottleOpenedAt: string;
  totalPills: string;
  pillsPerDay: string;
}

export default function Stock({ user }: Props) {
  const { supplements, loading: suppLoading, error: suppError, idByNotionId } = useSupplements(user);
  const { data: stockData, loading: stockLoading, updateBottle } = useStock();
  const [editState, setEditState] = useState<EditState | null>(null);
  const restockedRef = useRef<Set<string>>(new Set());

  const getEntry = useCallback(
    (localId: number) => stockData.find((s) => s.supplementId === localId),
    [stockData]
  );

  // Mark low-stock supplements for restock — only once per session
  useEffect(() => {
    if (suppLoading || stockLoading) return;
    for (const sup of supplements) {
      const localId = idByNotionId[sup.notion_id];
      if (localId == null) continue;
      const entry = getEntry(localId);
      if (!entry) continue;
      const { daysRemaining } = calcDays(entry);
      if (daysRemaining != null && daysRemaining < 7 && !restockedRef.current.has(sup.notion_id)) {
        restockedRef.current.add(sup.notion_id);
        markForRestock(sup.notion_id).catch((e) =>
          console.warn('markForRestock failed', sup.notion_id, e)
        );
      }
    }
  }, [supplements, stockData, suppLoading, stockLoading, idByNotionId, getEntry]);

  const openModal = (sup: Supplement) => {
    const localId = idByNotionId[sup.notion_id];
    if (localId == null) {
      Alert.alert('Sin datos locales', 'Este suplemento aún no está sincronizado en la DB local.');
      return;
    }
    const entry = getEntry(localId);
    setEditState({
      supplement: sup,
      localId,
      bottleOpenedAt: entry?.bottleOpenedAt ?? todayISO(),
      totalPills: entry?.totalPills?.toString() ?? '',
      pillsPerDay: entry?.pillsPerDay?.toString() ?? '',
    });
  };

  const handleSave = async () => {
    if (!editState) return;
    const total = parseFloat(editState.totalPills);
    const perDay = parseFloat(editState.pillsPerDay);
    if (isNaN(total) || total <= 0 || isNaN(perDay) || perDay <= 0) {
      Alert.alert('Valores inválidos', 'Ingresá números positivos para total y pastillas/día.');
      return;
    }
    await updateBottle(editState.localId, editState.bottleOpenedAt, total, perDay);
    setEditState(null);
  };

  const handleOpenNewBottle = async () => {
    if (!editState) return;
    const total = parseFloat(editState.totalPills);
    const perDay = parseFloat(editState.pillsPerDay);
    if (isNaN(total) || total <= 0 || isNaN(perDay) || perDay <= 0) {
      Alert.alert('Valores inválidos', 'Completá total de pastillas y pastillas/día primero.');
      return;
    }
    const today = todayISO();
    await updateBottle(editState.localId, today, total, perDay);
    // Remove from restocked set so it can be re-evaluated
    restockedRef.current.delete(editState.supplement.notion_id);
    setEditState(null);
  };

  if (suppLoading || stockLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#888" />
      </View>
    );
  }

  if (suppError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error al cargar suplementos: {suppError.message}</Text>
      </View>
    );
  }

  const lowCount = supplements.filter((sup) => {
    const localId = idByNotionId[sup.notion_id];
    if (localId == null) return false;
    const entry = getEntry(localId);
    if (!entry) return false;
    const { daysRemaining } = calcDays(entry);
    return daysRemaining != null && daysRemaining < 7;
  }).length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stock</Text>

      {lowCount > 0 && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>
            Bajo stock: {lowCount} suplemento{lowCount > 1 ? 's' : ''} con menos de 7 días
          </Text>
        </View>
      )}

      <FlatList
        data={supplements}
        keyExtractor={(s) => s.notion_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const localId = idByNotionId[item.notion_id];
          const entry = localId != null ? getEntry(localId) : undefined;
          const { daysRemaining } = entry ? calcDays(entry) : { daysRemaining: null };
          const isLow = daysRemaining != null && daysRemaining < 7;

          return (
            <TouchableOpacity style={styles.row} onPress={() => openModal(item)} activeOpacity={0.7}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowDose}>{item.dose}</Text>
              </View>
              <View style={styles.rowRight}>
                {daysRemaining != null ? (
                  <>
                    <View style={[styles.badge, isLow && styles.badgeLow]}>
                      <Text style={[styles.badgeText, isLow && styles.badgeTextLow]}>
                        {daysRemaining}d
                      </Text>
                    </View>
                    <Text style={styles.badgeLabel}>días restantes</Text>
                  </>
                ) : (
                  <Text style={styles.noData}>Sin datos</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <Modal
        visible={editState != null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditState(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setEditState(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{editState?.supplement.name}</Text>

            <Text style={styles.label}>Fecha de apertura del frasco</Text>
            <TextInput
              style={styles.input}
              value={editState?.bottleOpenedAt ?? ''}
              onChangeText={(v) => setEditState((s) => s && { ...s, bottleOpenedAt: v })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#bbb"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.label}>Total de pastillas en el frasco</Text>
            <TextInput
              style={styles.input}
              value={editState?.totalPills ?? ''}
              onChangeText={(v) => setEditState((s) => s && { ...s, totalPills: v })}
              placeholder="60"
              placeholderTextColor="#bbb"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Pastillas por día</Text>
            <TextInput
              style={styles.input}
              value={editState?.pillsPerDay ?? ''}
              onChangeText={(v) => setEditState((s) => s && { ...s, pillsPerDay: v })}
              placeholder="1"
              placeholderTextColor="#bbb"
              keyboardType="decimal-pad"
            />

            <TouchableOpacity style={styles.newBottleBtn} onPress={handleOpenNewBottle}>
              <Text style={styles.newBottleBtnText}>Abrí frasco nuevo</Text>
            </TouchableOpacity>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditState(null)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#E53935', textAlign: 'center', padding: 20 },
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
  alertText: { color: '#E65100', fontWeight: '500', fontSize: 13 },

  list: { padding: 20, gap: 10 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowInfo: { flex: 1, marginRight: 12 },
  rowName: { fontSize: 16, fontWeight: '500', color: '#222' },
  rowDose: { fontSize: 13, color: '#888', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 2 },

  badge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 48,
    alignItems: 'center',
  },
  badgeLow: { backgroundColor: '#FFEBEE' },
  badgeText: { fontSize: 16, fontWeight: '700', color: '#388E3C' },
  badgeTextLow: { color: '#E53935' },
  badgeLabel: { fontSize: 10, color: '#aaa' },
  noData: { fontSize: 12, color: '#bbb' },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 8 },
  label: { fontSize: 13, color: '#666', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#FAFAFA',
  },
  newBottleBtn: {
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  newBottleBtnText: { color: '#1565C0', fontWeight: '600', fontSize: 15 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontWeight: '500' },
  saveBtn: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '600' },
});
