import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { markForRestock } from '../api/notion';
import {
  reviveSharedStockMapFromCache,
  sharedStockToStockEntry,
  updateSharedStock,
  type SharedStock,
} from '../api/sharedStock';
import { useCache } from '../hooks/useCache';
import { useHealthData } from '../hooks/useHealthData';
import { fetchSupplementsWithStock } from '../hooks/useSupplements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendarDayLocal } from '../hooks/useSelectableLogDate';
import { useStock } from '../hooks/useStock';
import type { Supplement, StockEntry } from '../types';
import { filterSupplementsByCurrentTemporada } from '../utils/temporadaFilter';
import { getLocalTodayISO } from '../utils/dateUtils';
import { reportErrorToSentry } from '../utils/observability';
import {
  FLOATING_TAB_BAR_EXTRA,
  SCREEN_PADDING_TOP_EXTRA,
  SCREEN_SCROLL_PADDING_BOTTOM_EXTRA,
} from '../constants/floatingTabBar';
import { theme } from '../theme/colors';

import type { User } from '../context/UserContext';

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
    (Date.now() - bottleOpenedAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  const pillsRemaining = entry.totalPills - daysSinceOpened * entry.pillsPerDay;
  const daysRemaining = Math.floor(pillsRemaining / entry.pillsPerDay);
  return { daysRemaining, pillsRemaining };
}

function parseBottleDateInput(isoDay: string): Date {
  const s = isoDay.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function resolveStockEntry(
  sup: Supplement,
  localId: number | undefined,
  stockData: StockEntry[],
  sharedByNotionId: Record<string, SharedStock | null>,
): StockEntry | undefined {
  if (sup.persona === 'Ambas') {
    const sh = sharedByNotionId[sup.notion_id];
    if (!sh) return undefined;
    return sharedStockToStockEntry(sh, localId ?? 0);
  }
  if (localId == null) return undefined;
  return stockData.find((s) => s.supplementId === localId);
}

interface EditState {
  supplement: Supplement;
  localId: number | null;
  bottleOpenedAt: string;
  totalPills: string;
  pillsPerDay: string;
}

export default function Stock({ user }: Props) {
  const insets = useSafeAreaInsets();
  const calendarDayKey = useCalendarDayLocal();
  const { cyclePhase } = useHealthData(user, { calendarDayKey });
  const fetchStockBundle = useCallback(
    () => fetchSupplementsWithStock(user, cyclePhase ?? ''),
    [user, cyclePhase, calendarDayKey],
  );
  const {
    data: stockBundle,
    loading: cacheLoading,
    error: cacheError,
    refreshing,
    refresh: refreshStockBundle,
  } = useCache(`stock_${user}_${calendarDayKey}`, fetchStockBundle, 5 * 60 * 1000);

  const supplements = stockBundle?.supplements ?? [];
  const idByNotionId = stockBundle?.idByNotionId ?? {};
  const sharedByNotionId = useMemo(
    () =>
      stockBundle?.sharedByNotionId
        ? reviveSharedStockMapFromCache(stockBundle.sharedByNotionId)
        : {},
    [stockBundle],
  );

  const { data: stockData, loading: stockLoading, updateBottle, setRestockFlagged } = useStock();
  const [editState, setEditState] = useState<EditState | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [temporadaView, setTemporadaView] = useState<'all' | 'current'>('all');

  const visibleSupplements = useMemo(() => {
    if (temporadaView === 'all') return supplements;
    return filterSupplementsByCurrentTemporada(supplements, cyclePhase ?? '');
  }, [supplements, temporadaView, cyclePhase]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const getEntry = useCallback(
    (sup: Supplement, localId: number | undefined) =>
      resolveStockEntry(sup, localId, stockData, sharedByNotionId),
    [stockData, sharedByNotionId],
  );

  // Mark low-stock in Notion once per fila (persistido en SQLite o backend como restock_flagged)
  useEffect(() => {
    if (cacheLoading && !stockBundle) return;
    if (stockLoading) return;
    let cancelled = false;
    (async () => {
      for (const sup of supplements) {
        if (cancelled) return;
        const localId = idByNotionId[sup.notion_id];
        const entry = getEntry(sup, localId);
        if (!entry) continue;
        const { daysRemaining } = calcDays(entry);
        if (daysRemaining != null && daysRemaining < 7 && !entry.restockFlagged) {
          try {
            await markForRestock(sup.notion_id);
            if (cancelled) return;
            if (sup.persona === 'Ambas') {
              await updateSharedStock(sup.notion_id, { restockFlagged: true });
              await refreshStockBundle();
            } else if (localId != null) {
              await setRestockFlagged(localId, true);
            }
          } catch (e) {
            reportErrorToSentry(e, {
              domain: 'stock_restock',
              notion_id: sup.notion_id,
              user,
            });
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    supplements,
    stockData,
    sharedByNotionId,
    cacheLoading,
    stockBundle,
    stockLoading,
    idByNotionId,
    getEntry,
    setRestockFlagged,
    refreshStockBundle,
  ]);

  const openModal = (sup: Supplement) => {
    const localId = idByNotionId[sup.notion_id];
    if (sup.persona !== 'Ambas' && localId == null) {
      Alert.alert('Sin datos locales', 'Este suplemento aún no está sincronizado en la DB local.');
      return;
    }
    const entry = getEntry(sup, localId);
    setEditState({
      supplement: sup,
      localId: localId ?? null,
      bottleOpenedAt: entry?.bottleOpenedAt ?? getLocalTodayISO(),
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
    try {
      if (editState.supplement.persona === 'Ambas') {
        await updateSharedStock(editState.supplement.notion_id, {
          bottleOpenedAt: parseBottleDateInput(editState.bottleOpenedAt),
          totalPills: total,
          pillsPerDay: perDay,
        });
        await refreshStockBundle();
      } else {
        if (editState.localId == null) return;
        await updateBottle(editState.localId, editState.bottleOpenedAt, total, perDay);
      }
      setEditState(null);
    } catch (e) {
      reportErrorToSentry(e, { domain: 'stock_save', user });
      Alert.alert(
        'Error',
        'No se pudo guardar el stock. Revisá la conexión o la clave del backend.',
      );
    }
  };

  const handleOpenNewBottle = async () => {
    if (!editState) return;
    const total = parseFloat(editState.totalPills);
    const perDay = parseFloat(editState.pillsPerDay);
    if (isNaN(total) || total <= 0 || isNaN(perDay) || perDay <= 0) {
      Alert.alert('Valores inválidos', 'Completá total de pastillas y pastillas/día primero.');
      return;
    }
    const today = getLocalTodayISO();
    try {
      if (editState.supplement.persona === 'Ambas') {
        await updateSharedStock(editState.supplement.notion_id, {
          bottleOpenedAt: parseBottleDateInput(today),
          totalPills: total,
          pillsPerDay: perDay,
          restockFlagged: false,
        });
        await refreshStockBundle();
      } else {
        if (editState.localId == null) return;
        await updateBottle(editState.localId, today, total, perDay, { resetRestockFlag: true });
      }
      setEditState(null);
    } catch (e) {
      reportErrorToSentry(e, { domain: 'stock_new_bottle', user });
      Alert.alert(
        'Error',
        'No se pudo guardar el stock. Revisá la conexión o la clave del backend.',
      );
    }
  };

  if ((cacheLoading && !stockBundle) || stockLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (cacheError && !stockBundle) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error al cargar suplementos: {cacheError.message}</Text>
      </View>
    );
  }

  const lowCount = supplements.filter((sup) => {
    const localId = idByNotionId[sup.notion_id];
    if (sup.persona !== 'Ambas' && localId == null) return false;
    const entry = getEntry(sup, localId);
    if (!entry) return false;
    const { daysRemaining } = calcDays(entry);
    return daysRemaining != null && daysRemaining < 7;
  }).length;

  return (
    <View style={[styles.container, { paddingTop: SCREEN_PADDING_TOP_EXTRA + insets.top }]}>
      <Text style={styles.title}>Stock</Text>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, temporadaView === 'all' && styles.filterChipActive]}
          onPress={() => setTemporadaView('all')}
        >
          <Text
            style={[styles.filterChipText, temporadaView === 'all' && styles.filterChipTextActive]}
          >
            Todas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, temporadaView === 'current' && styles.filterChipActive]}
          onPress={() => setTemporadaView('current')}
        >
          <Text
            style={[
              styles.filterChipText,
              temporadaView === 'current' && styles.filterChipTextActive,
            ]}
          >
            Temporada actual
          </Text>
        </TouchableOpacity>
      </View>

      {lowCount > 0 && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>
            Bajo stock: {lowCount} suplemento{lowCount > 1 ? 's' : ''} con menos de 7 días
          </Text>
        </View>
      )}

      <FlatList
        data={visibleSupplements}
        keyExtractor={(s) => s.notion_id}
        style={styles.listFlex}
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom:
              SCREEN_SCROLL_PADDING_BOTTOM_EXTRA + insets.bottom + FLOATING_TAB_BAR_EXTRA,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshStockBundle} />}
        ListEmptyComponent={
          temporadaView === 'current' ? (
            <Text style={styles.emptyFilterText}>
              Ningún suplemento coincide con mes + fase actuales.
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const localId = idByNotionId[item.notion_id];
          const entry =
            item.persona === 'Ambas' || localId != null ? getEntry(item, localId) : undefined;
          const { daysRemaining } = entry ? calcDays(entry) : { daysRemaining: null };
          const isLow = daysRemaining != null && daysRemaining < 7;

          return (
            <TouchableOpacity
              style={[styles.row, isLow && styles.rowLow]}
              onPress={() => openModal(item)}
              activeOpacity={0.7}
            >
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
        <Pressable
          style={styles.overlay}
          onPress={() => {
            if (keyboardVisible) {
              Keyboard.dismiss();
              return;
            }
            setEditState(null);
          }}
        >
          <View style={styles.sheet}>
            <KeyboardAvoidingView
              behavior="padding"
              keyboardVerticalOffset={8}
              style={styles.sheetKav}
            >
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
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
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  listFlex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: theme.errorText, textAlign: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: theme.text, padding: 20, paddingBottom: 8 },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: theme.bgElevated,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterChipActive: {
    backgroundColor: theme.successMuted,
    borderColor: theme.successText,
  },
  filterChipText: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: theme.successText },
  emptyFilterText: {
    textAlign: 'center',
    color: theme.textMuted,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },

  alertBanner: {
    backgroundColor: theme.warningBg,
    borderLeftWidth: 4,
    borderLeftColor: theme.accent,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
  },
  alertText: { color: theme.warningText, fontWeight: '500', fontSize: 13 },

  list: { padding: 20, gap: 10 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rowLow: {
    backgroundColor: theme.errorBg,
    borderWidth: 1,
    borderColor: 'rgba(229, 57, 53, 0.35)',
  },
  rowInfo: { flex: 1, marginRight: 12 },
  rowName: { fontSize: 16, fontWeight: '500', color: theme.text },
  rowDose: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 2 },

  badge: {
    backgroundColor: theme.successMuted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 48,
    alignItems: 'center',
  },
  badgeLow: { backgroundColor: theme.errorBg },
  badgeText: { fontSize: 16, fontWeight: '700', color: theme.successText },
  badgeTextLow: { color: theme.errorText },
  badgeLabel: { fontSize: 10, color: theme.textMuted },
  noData: { fontSize: 12, color: theme.textMuted },

  overlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxHeight: Math.round(Dimensions.get('window').height * 0.88),
    padding: 24,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: theme.border,
  },
  sheetKav: {
    width: '100%',
  },
  sheetScroll: {
    maxHeight: Math.round(Dimensions.get('window').height * 0.62),
  },
  sheetScrollContent: {
    flexGrow: 1,
    gap: 8,
    paddingBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 8 },
  label: { fontSize: 13, color: theme.textSecondary, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: theme.text,
    backgroundColor: theme.inputBg,
  },
  newBottleBtn: {
    backgroundColor: 'rgba(100, 181, 246, 0.2)',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  newBottleBtnText: { color: '#90CAF9', fontWeight: '600', fontSize: 15 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    backgroundColor: theme.card,
  },
  cancelBtnText: { color: theme.textSecondary, fontWeight: '500' },
  saveBtn: {
    flex: 1,
    backgroundColor: theme.accent,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '600' },
});
