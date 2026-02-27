import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Colors } from '../constants/colors';
import { ThemedText } from './themed-text';

import type { KeyboardTypeOptions } from 'react-native';

export type DialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: (inputValue?: string) => void;
};

export type CustomDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: DialogButton[];
  onClose: () => void;
  inputMode?: boolean;
  inputPlaceholder?: string;
  inputDefaultValue?: string;
  inputKeyboardType?: KeyboardTypeOptions;
};

export function CustomDialog({
  visible,
  title,
  message,
  buttons = [{ text: 'OK' }],
  onClose,
  inputMode,
  inputPlaceholder,
  inputDefaultValue = '',
  inputKeyboardType,
}: CustomDialogProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const [inputValue, setInputValue] = useState(inputDefaultValue);

  useEffect(() => {
    if (visible) {
      setInputValue(inputDefaultValue);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible, inputDefaultValue, fadeAnim, scaleAnim]);

  const handlePress = (button: DialogButton) => {
    onClose();
    try {
      const result = button.onPress?.(inputMode ? inputValue : undefined);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch((err: unknown) =>
          console.error('Dialog handler error:', err)
        );
      }
    } catch (err) {
      console.error('Dialog handler error:', err);
    }
  };

  const getButtonStyle = (style?: 'default' | 'cancel' | 'destructive') => {
    switch (style) {
      case 'destructive':
        return styles.buttonDestructive;
      case 'cancel':
        return styles.buttonCancel;
      default:
        return styles.buttonDefault;
    }
  };

  const getButtonTextStyle = (style?: 'default' | 'cancel' | 'destructive') => {
    switch (style) {
      case 'destructive':
        return styles.buttonTextDestructive;
      case 'cancel':
        return styles.buttonTextCancel;
      default:
        return styles.buttonTextDefault;
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.fullscreen, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          style={styles.centered}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.dialog,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <ThemedText style={styles.title}>{title}</ThemedText>
            {message ? (
              <ThemedText style={styles.message}>{message}</ThemedText>
            ) : null}

            {inputMode && (
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder={inputPlaceholder}
                placeholderTextColor={Colors.textTertiary}
                keyboardType={inputKeyboardType}
                autoFocus
                selectTextOnFocus
              />
            )}

            <View style={[styles.buttons, buttons.length > 2 && styles.buttonsVertical]}>
              {buttons.map((button, index) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    styles.button,
                    getButtonStyle(button.style),
                    buttons.length <= 2 && styles.buttonFlex,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handlePress(button)}
                >
                  <ThemedText style={[styles.buttonText, getButtonTextStyle(button.style)]}>
                    {button.text}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
  },
  fullscreen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  dialog: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  buttonsVertical: {
    flexDirection: 'column',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFlex: {
    flex: 1,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDefault: {
    backgroundColor: Colors.textPrimary,
  },
  buttonCancel: {
    backgroundColor: Colors.border,
  },
  buttonDestructive: {
    backgroundColor: Colors.red,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  buttonTextDefault: {
    color: '#000',
  },
  buttonTextCancel: {
    color: Colors.textPrimary,
  },
  buttonTextDestructive: {
    color: '#FFF',
  },
});
