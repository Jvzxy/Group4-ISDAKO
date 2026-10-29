// Small building blocks used by every screen: buttons, fields, notices, the toast, and the scrolling page.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT, colors } from './theme';

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'dark' | 'ghost' | 'light' | 'danger';

const VARIANTS: Record<Variant, { box: ViewStyle; text: string }> = {
  primary: { box: { backgroundColor: colors.yellow, borderColor: colors.yellow }, text: colors.yellowInk },
  dark: { box: { backgroundColor: colors.abyss, borderColor: colors.abyss }, text: '#ffffff' },
  ghost: { box: { backgroundColor: 'transparent', borderColor: colors.line }, text: colors.abyss },
  /** outline button for dark backgrounds */
  light: { box: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.5)' }, text: '#ffffff' },
  danger: { box: { backgroundColor: colors.coral, borderColor: colors.coral }, text: '#ffffff' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  small = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  const look = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        look.box,
        pressed && styles.pressed,
        off && styles.off,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.text} />
      ) : (
        <Text style={[styles.buttonText, { color: look.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

/** A text-only button, for secondary actions. */
export function LinkButton({
  title,
  onPress,
  danger = false,
  light = false,
}: {
  title: string;
  onPress: () => void;
  danger?: boolean;
  light?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={styles.linkWrap}>
      <Text style={[styles.link, danger && styles.linkDanger, light && styles.linkLight]}>{title}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Text and forms
// ---------------------------------------------------------------------------

export function Title({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <Text accessibilityRole="header" style={[styles.title, light && styles.onDark]}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Text>
  );
}

export function Muted({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <Text style={[styles.muted, light && styles.mutedLight]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? (
    <Text accessibilityRole="alert" style={styles.errorText}>
      {children}
    </Text>
  ) : null;
}

export function Field({ label, hint, ...input }: { label: string; hint?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...input}
        style={[styles.input, input.style]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.line, true: colors.abyss }}
        thumbColor={colors.foam}
      />
    </View>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <View style={styles.notice}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Page: scrolls, keeps the keyboard from covering fields, optional pull-to-refresh
// ---------------------------------------------------------------------------

export function Screen({
  children,
  refreshControl,
  contentStyle,
}: {
  children: ReactNode;
  refreshControl?: ReactElement;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.screenContent, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

type ToastKind = 'ok' | 'error';
interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => undefined);

export const useToast = (): ((message: string, kind?: ToastKind) => void) => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const counter = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = 'ok') => {
    counter.current += 1;
    setToast({ id: counter.current, message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const shown = toast;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const timer = setTimeout(
      () => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
          if (finished) setToast((current) => (current && current.id === shown.id ? null : current));
        });
      },
      shown.kind === 'error' ? 5000 : 3000,
    );
    return () => clearTimeout(timer);
  }, [toast, opacity]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          style={[styles.toastWrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + 16, opacity }]}
        >
          <View style={[styles.toast, toast.kind === 'error' && styles.toastError]}>
            <Text accessibilityLiveRegion="polite" style={styles.toastText}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenContent: { padding: 16, paddingBottom: 32 },

  button: {
    minHeight: 50,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 44, paddingHorizontal: 14 },
  buttonText: { fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.85, transform: [{ translateY: 1 }] },
  off: { opacity: 0.55 },

  linkWrap: { paddingVertical: 8, alignSelf: 'flex-start' },
  link: { fontSize: 15, fontWeight: '700', textDecorationLine: 'underline', color: colors.abyss },
  linkDanger: { color: colors.coral },
  linkLight: { color: '#ffffff' },

  title: { fontSize: 26, fontWeight: '800', color: colors.abyss },
  onDark: { color: '#ffffff' },
  sectionTitle: { marginTop: 24, marginBottom: 4, fontSize: 19, fontWeight: '800', color: colors.abyss },
  muted: { fontSize: 15, lineHeight: 21, color: colors.muted },
  mutedLight: { color: colors.onDarkMuted },
  errorText: { fontSize: 15, fontWeight: '700', color: colors.coral },

  field: { marginTop: 14 },
  label: { fontSize: 16, fontWeight: '700', color: colors.abyss },
  hint: { marginTop: 4, fontSize: 14, lineHeight: 19, color: colors.muted },
  input: {
    minHeight: 52,
    marginTop: 6,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.foam,
    fontSize: 18,
    color: colors.abyss,
  },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  switchText: { flex: 1 },

  notice: {
    marginTop: 16,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: 14,
  },

  toastWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', pointerEvents: 'none' },
  toast: { maxWidth: 420, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.abyss },
  toastError: { backgroundColor: colors.coral },
  toastText: { color: '#ffffff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
