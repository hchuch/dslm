import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '../components/themed-text';
import { useAuth } from '../contexts/auth-context';
import { getApiBaseUrl, setApiBaseUrl, getApiBaseUrlSync } from '../services/api-config';

export default function SplashScreen() {
  const { login, loginError, isLoading } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    getApiBaseUrl().then(setServerUrl);
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      return;
    }

    const success = await login(username, password);
    if (success) {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.content}>
              <View style={styles.header}>
                <View style={styles.logoContainer}>
                  <View style={styles.logoInner}>
                    <ThemedText style={styles.logoText}>DSLM</ThemedText>
                  </View>
                  <View style={styles.logoGlow} />
                </View>
                <ThemedText style={styles.title}>Deep Space</ThemedText>
                <ThemedText style={styles.subtitle}>Logistics Module</ThemedText>
                <View style={styles.divider} />
                <ThemedText style={styles.instruction}>Identify Mission Profile</ThemedText>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>OPERATOR ID</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter username"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    value={username}
                    onChangeText={setUsername}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>ACCESS CODE</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Password"
                    placeholderTextColor="#666"
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                {loginError && (
                  <ThemedText style={styles.errorText}>
                    {loginError}
                  </ThemedText>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed && styles.loginButtonPressed,
                    isLoading && styles.loginButtonDisabled
                  ]}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <ThemedText style={styles.loginButtonText}>INITIATE LINK</ThemedText>
                  )}
                </Pressable>

              </View>
            </View>

            <View style={styles.footer}>
              <Pressable
                onPress={() => {
                  Alert.prompt(
                    'Server URL',
                    'Enter your laptop\'s IP address and port.\nExample: http://192.168.1.42:4000',
                    [
                      { text: 'Reset Default', onPress: async () => {
                        await setApiBaseUrl(null);
                        const url = await getApiBaseUrl();
                        setServerUrl(url);
                      }},
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Save', onPress: async (value) => {
                        if (value) {
                          await setApiBaseUrl(value);
                          setServerUrl(value);
                        }
                      }},
                    ],
                    'plain-text',
                    serverUrl,
                  );
                }}
              >
                <ThemedText style={styles.serverUrl}>
                  Server: {serverUrl}
                </ThemedText>
                <ThemedText style={styles.serverTap}>Tap to change</ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoContainer: {
    width: 100,
    height: 100,
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 80,
    height: 80,
    backgroundColor: '#000',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 2,
  },
  logoGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    backgroundColor: '#0F6FFF',
    opacity: 0.2,
    borderRadius: 30,
    shadowColor: '#0F6FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    color: '#FFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 36,
  },
  divider: {
    width: 40,
    height: 4,
    backgroundColor: '#0F6FFF',
    borderRadius: 2,
    marginTop: 20,
    marginBottom: 20,
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  formContainer: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    gap: 16,
  },
  inputGroup: {
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    color: '#888',
    marginBottom: 6,
    letterSpacing: 1,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 14,
    color: '#FFF',
    fontSize: 16,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  loginButton: {
    backgroundColor: '#0F6FFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  loginButtonPressed: {
    opacity: 0.8,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#444',
    fontWeight: '600',
  },
  footerSubText: {
    fontSize: 12,
    color: '#333',
    marginTop: 4,
  },
  serverUrl: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
    fontFamily: 'Courier',
  },
  serverTap: {
    fontSize: 10,
    color: '#0F6FFF',
    textAlign: 'center',
    marginTop: 4,
  },
});