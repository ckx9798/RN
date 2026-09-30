import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

import type { LabelFields } from './extract-label-fields';

const MIN_TOUCH_TARGET = 44;

type ScannerReviewProps = {
  /** OCR 결과 초기값. 이 컴포넌트가 교정 상태를 직접 소유한다. */
  initialFields: LabelFields;
  onSubmit(fields: LabelFields): void;
  onRetakeProduct(): void;
  onRetakeIngredients(): void;
  onCancel(): void;
};

/**
 * OCR로 추출한 필드를 사용자가 직접 확인·교정하는 화면. 원재료가 비어
 * 있으면 경고를 보여주고 전송 버튼을 비활성화한다(브리프 Step 3).
 * 교정 상태는 이 컴포넌트가 직접 들고 있다 — 재촬영으로 새 OCR 결과가
 * 나오면 상위(ScannerScreen)가 review 단계를 벗어났다가 다시 들어오면서
 * 이 컴포넌트를 새로 마운트하므로 initialFields가 그대로 초기값이 된다.
 */
export function ScannerReview({
  initialFields,
  onSubmit,
  onRetakeProduct,
  onRetakeIngredients,
  onCancel,
}: ScannerReviewProps) {
  const theme = useTheme();
  const [fields, setFields] = useState(initialFields);
  const ingredientsEmpty = fields.ingredientsText.trim().length === 0;

  function updateField<K extends keyof LabelFields>(key: K, value: LabelFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ThemedText type="subtitle" style={styles.heading}>
            촬영 결과를 확인해 주세요
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            인식된 내용이 라벨과 다르면 직접 수정할 수 있어요.
          </ThemedText>

          <ReviewField
            label="제품명"
            value={fields.productName ?? ''}
            onChangeText={(value) => updateField('productName', value.length > 0 ? value : null)}
          />
          <ReviewField
            label="제조사"
            value={fields.manufacturer ?? ''}
            onChangeText={(value) => updateField('manufacturer', value.length > 0 ? value : null)}
          />
          <ReviewField
            label="품목보고번호"
            value={fields.reportNumber ?? ''}
            keyboardType="number-pad"
            onChangeText={(value) => {
              const digitsOnly = value.replace(/[^0-9]/g, '');
              updateField('reportNumber', digitsOnly.length > 0 ? digitsOnly : null);
            }}
          />

          <View style={styles.field}>
            <ThemedText type="smallBold">원재료명</ThemedText>
            <TextInput
              value={fields.ingredientsText}
              onChangeText={(value) => updateField('ingredientsText', value)}
              multiline
              accessibilityLabel="원재료명"
              style={[styles.multilineInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            {ingredientsEmpty && (
              <ThemedText type="small" themeColor="text" style={styles.warning}>
                원재료가 인식되지 않았어요. 다시 촬영해 주세요.
              </ThemedText>
            )}
          </View>

          <ReviewField
            label="알레르기 표시"
            value={fields.allergenStatement ?? ''}
            multiline
            onChangeText={(value) => updateField('allergenStatement', value.length > 0 ? value : null)}
          />
          <ReviewField
            label="교차혼입 문구"
            value={fields.crossContaminationStatement ?? ''}
            multiline
            onChangeText={(value) => updateField('crossContaminationStatement', value.length > 0 ? value : null)}
          />

          <View style={styles.retakeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="원재료면 다시 촬영"
              onPress={onRetakeIngredients}
              style={[styles.secondaryButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="small">원재료면 다시 촬영</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="제품면 다시 촬영"
              onPress={onRetakeProduct}
              style={[styles.secondaryButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="small">제품면 다시 촬영</ThemedText>
            </Pressable>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="촬영 취소"
              onPress={onCancel}
              style={[styles.secondaryButton, styles.flexButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="smallBold">취소</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="분석 요청 보내기"
              accessibilityState={{ disabled: ingredientsEmpty }}
              onPress={() => onSubmit(fields)}
              disabled={ingredientsEmpty}
              style={[
                styles.submitButton,
                styles.flexButton,
                { backgroundColor: ingredientsEmpty ? theme.backgroundSelected : theme.link },
              ]}
            >
              <ThemedText themeColor="background" type="smallBold">
                분석 요청 보내기
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

type ReviewFieldProps = {
  label: string;
  value: string;
  onChangeText(value: string): void;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
};

function ReviewField({ label, value, onChangeText, multiline, keyboardType }: ReviewFieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        accessibilityLabel={label}
        style={[
          multiline ? styles.multilineInput : styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  heading: {
    marginBottom: -Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  multilineInput: {
    minHeight: MIN_TOUCH_TARGET * 2,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
  warning: {
    marginTop: Spacing.half,
  },
  retakeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flexButton: {
    flex: 1,
  },
  secondaryButton: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  submitButton: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});
