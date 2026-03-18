import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
} from 'react-native';
import { useSupplements } from '../hooks/useSupplements';
import { useDailyLog } from '../hooks/useDailyLog';
import { useUser } from '../context/UserContext';
import type { Supplement } from '../types';

function SupplementItem({
  supplement,
  taken,
  onToggle,
}: {
  supplement: Supplement;
  taken: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.item, taken && styles.itemTaken]} onPress={onToggle}>
      <View style={[styles.checkbox, taken && styles.checkboxChecked]}>
        {taken && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, taken && styles.itemNameTaken]}>{supplement.name}</Text>
        <Text style={styles.itemDose}>{supplement.dose}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function Checklist() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const { user } = useUser();
  const { supplements, idByNotionId } = useSupplements(user);
  const { isTaken, markTaken } = useDailyLog(selectedDate);

  const takenCount = supplements.reduce((count, s) => {
    const localId = idByNotionId[s.notion_id];
    if (!localId) return count;
    return count + (isTaken(localId) ? 1 : 0);
  }, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Checklist</Text>
        <Text style={styles.counter}>{takenCount}/{supplements.length}</Text>
      </View>

      <TextInput
        style={styles.dateInput}
        value={selectedDate}
        onChangeText={setSelectedDate}
        placeholder="YYYY-MM-DD"
      />

      <FlatList
        data={supplements}
        keyExtractor={(s) => s.notion_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const localId = idByNotionId[item.notion_id];
          const taken = localId ? isTaken(localId) : false;
          return (
            <SupplementItem
              supplement={item}
              taken={taken}
              onToggle={() => {
                if (!localId) return;
                markTaken(localId, !taken);
              }}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#222' },
  counter: { fontSize: 18, color: '#888' },
  dateInput: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  list: { padding: 20, gap: 10 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },
  itemTaken: { opacity: 0.55 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: '#81C784', borderColor: '#81C784' },
  checkmark: { color: '#fff', fontWeight: '700', fontSize: 14 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '500', color: '#222' },
  itemNameTaken: { textDecorationLine: 'line-through', color: '#aaa' },
  itemDose: { fontSize: 13, color: '#888', marginTop: 2 },
  phaseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  chip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: { fontSize: 11, color: '#555' },
});
