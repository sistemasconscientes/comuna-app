import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CartesianChart, Line, Area } from 'victory-native';
import type { Scale } from 'victory-native';
import { Line as SkiaLine, DashPathEffect, vec } from '@shopify/react-native-skia';

const ENERGY_CURVE = [
  { x: 0, value: 3 },
  { x: 3, value: 3 },
  { x: 4, value: 5 },
  { x: 10, value: 8 },
  { x: 13, value: 9 },
  { x: 16, value: 8 },
  { x: 17, value: 7 },
  { x: 24, value: 5 },
  { x: 27, value: 3 },
];

const PHASE_ENERGY_LABEL: Record<
  'menstrual' | 'folicular' | 'ovulatoria' | 'lutea',
  string
> = {
  menstrual: 'Bajo',
  folicular: 'Moderado',
  ovulatoria: 'Alto',
  lutea: 'Moderado',
};

const X_PHASE_LABELS: { x: number; label: string }[] = [
  { x: 1, label: 'MENST.' },
  { x: 7, label: 'FOLICULAR' },
  { x: 14, label: 'OVUL.' },
  { x: 21, label: 'LÚTEA' },
];

const CHART_HEIGHT = 200;

export type EnergyChartPhase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea';

type Props = {
  currentPhase: EnergyChartPhase;
  dayInCycle: number;
};

export function EnergyChart({ currentPhase, dayInCycle }: Props) {
  const [labelXScale, setLabelXScale] = React.useState<Scale | null>(null);
  const dayClamped = Math.min(28, Math.max(1, Math.round(dayInCycle)));
  const markerX = Math.min(27, Math.max(0, dayClamped - 1));

  const onScaleChange = React.useCallback((xs: Scale) => {
    setLabelXScale(xs);
  }, []);

  const levelLabel = PHASE_ENERGY_LABEL[currentPhase];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>ENERGY LEVEL</Text>
        <Text style={styles.headerDay}>
          Day {dayClamped} of 28
        </Text>
      </View>
      <Text style={styles.levelBig}>{levelLabel}</Text>

      <View style={styles.chartWrap}>
        <CartesianChart
          data={ENERGY_CURVE}
          xKey="x"
          yKeys={['value']}
          domain={{ x: [0, 27], y: [0, 10] }}
          padding={{ left: 8, right: 8, top: 8, bottom: 4 }}
          onScaleChange={onScaleChange}
        >
          {({ points, chartBounds, xScale: xs }) => (
            <>
              <Area
                points={points.value}
                y0={chartBounds.bottom}
                curveType="catmullRom"
                color="#C97B6E"
                opacity={0.1}
              />
              <Line
                points={points.value}
                curveType="catmullRom"
                color="#C97B6E"
                strokeWidth={2}
              />
              <SkiaLine
                p1={vec(xs(markerX), chartBounds.top)}
                p2={vec(xs(markerX), chartBounds.bottom)}
                color="#9E9E9E"
                strokeWidth={1}
              >
                <DashPathEffect intervals={[4, 4]} />
              </SkiaLine>
            </>
          )}
        </CartesianChart>
      </View>

      <View style={styles.xLabelsTrack}>
        {labelXScale &&
          X_PHASE_LABELS.map(({ x, label }) => (
            <Text
              key={label}
              style={[
                styles.xLabel,
                { left: labelXScale(x) - 28, width: 56 },
              ]}
            >
              {label}
            </Text>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E4DC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 11,
    color: '#888',
    letterSpacing: 0.8,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerDay: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  levelBig: {
    fontSize: 26,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
  },
  chartWrap: {
    height: CHART_HEIGHT,
    width: '100%',
  },
  xLabelsTrack: {
    height: 22,
    marginTop: 4,
    position: 'relative',
  },
  xLabel: {
    position: 'absolute',
    fontSize: 9,
    color: '#888',
    textTransform: 'uppercase',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
