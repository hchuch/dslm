import { Ionicons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCameraPermissions } from "expo-camera";

import { ThemedText } from "../components/themed-text";
import { useAuth } from "../contexts/auth-context";
import { useDialog } from "../hooks/use-dialog";
import { getApiBaseUrl, setApiBaseUrl } from "../services/api-config";

export default function SplashScreen() {
  const { login, loginError, isLoading } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const { showDialog } = useDialog();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const qrLockRef = useRef(false);

  useEffect(() => {
    getApiBaseUrl().then(setServerUrl);
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      return;
    }

    const success = await login(username, password);
    if (success) {
      router.replace("/");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.content}>
              <View style={styles.header}>
                <Image
                  source={require("../assets/images/logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <ThemedText style={styles.title}>DSLM</ThemedText>
                <ThemedText style={styles.subtitle}>
                  Deep Space Logistics Module
                </ThemedText>
                <View style={styles.divider} />
                <ThemedText style={styles.programText}>
                  NASA Artemis Program
                </ThemedText>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>OPERATOR ID</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor="#555"
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
                    placeholder="Password"
                    placeholderTextColor="#555"
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                {loginError && (
                  <ThemedText style={styles.errorText}>{loginError}</ThemedText>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed && styles.loginButtonPressed,
                    isLoading && styles.loginButtonDisabled,
                  ]}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <ThemedText style={styles.loginButtonText}>
                      Sign In
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.footer}>
              <Pressable
                onPress={() => {
                  showDialog(
                    "Server URL",
                    "Enter the server address or scan a QR code.",
                    [
                      {
                        text: "Scan QR",
                        onPress: async () => {
                          if (!cameraPermission?.granted) {
                            const result = await requestCameraPermission();
                            if (!result.granted) return;
                          }
                          qrLockRef.current = false;
                          setShowQRScanner(true);
                        },
                      },
                      {
                        text: "Reset Default",
                        onPress: async () => {
                          await setApiBaseUrl(null);
                          const url = await getApiBaseUrl();
                          setServerUrl(url);
                        },
                      },
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Save",
                        onPress: async (value?: string) => {
                          if (value) {
                            await setApiBaseUrl(value);
                            setServerUrl(value);
                          }
                        },
                      },
                    ],
                    {
                      inputMode: true,
                      inputDefaultValue: serverUrl,
                      inputPlaceholder: "http://192.168.1.42:4000",
                    },
                  );
                }}
              >
                <ThemedText style={styles.serverUrl}>{serverUrl}</ThemedText>
                <ThemedText style={styles.serverTap}>
                  Configure server
                </ThemedText>
              </Pressable>
              <ThemedText style={styles.versionText}>
                Supply Chain Management System v1.0
              </ThemedText>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* QR Code Scanner Modal */}
      <Modal
        visible={showQRScanner}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.qrContainer}>
          <CameraView
            style={styles.qrCamera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={(result) => {
              if (qrLockRef.current) return;
              qrLockRef.current = true;
              const scannedUrl = result.data.trim();
              setShowQRScanner(false);
              setApiBaseUrl(scannedUrl).then(() => {
                setServerUrl(scannedUrl);
              });
            }}
          />
          <View style={styles.qrOverlay}>
            <SafeAreaView style={styles.qrSafeArea}>
              <View style={styles.qrHeader}>
                <Pressable
                  style={styles.qrCloseBtn}
                  onPress={() => setShowQRScanner(false)}
                >
                  <Ionicons name="close" size={28} color="#FFF" />
                </Pressable>
                <ThemedText style={styles.qrTitle}>Scan Server QR</ThemedText>
                <View style={{ width: 44 }} />
              </View>
            </SafeAreaView>
            <View style={styles.qrReticle} />
            <ThemedText style={styles.qrHint}>
              Point camera at server QR code
            </ThemedText>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 24,
    // backgroundColor: "blue",
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 6,
    textAlign: "center",
    marginBottom: 6,
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    color: "#999",
    letterSpacing: 2,
    textTransform: "uppercase",
    textAlign: "center",
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: "#333",
    marginTop: 20,
    marginBottom: 16,
  },
  programText: {
    fontSize: 12,
    color: "#666",
    letterSpacing: 3,
    textTransform: "uppercase",
    fontWeight: "500",
  },
  formContainer: {
    width: "100%",
    maxWidth: 320,
    alignSelf: "center",
    gap: 14,
  },
  inputGroup: {
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    color: "#777",
    marginBottom: 6,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "#222",
    borderRadius: 6,
    padding: 14,
    color: "#FFF",
    fontSize: 16,
  },
  errorText: {
    color: "#FF453A",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 4,
  },
  loginButton: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 8,
  },
  loginButtonPressed: {
    opacity: 0.85,
  },
  loginButtonDisabled: {
    opacity: 0.4,
  },
  loginButtonText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  footer: {
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  serverUrl: {
    fontSize: 11,
    color: "#444",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  serverTap: {
    fontSize: 11,
    color: "#555",
    textAlign: "center",
    marginTop: 2,
  },
  versionText: {
    fontSize: 10,
    color: "#333",
    marginTop: 8,
    letterSpacing: 0.5,
  },
  qrContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  qrCamera: {
    flex: 1,
  },
  qrOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    alignItems: "center",
  },
  qrSafeArea: {
    width: "100%",
  },
  qrHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  qrCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  qrTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFF",
  },
  qrReticle: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 16,
  },
  qrHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginBottom: 80,
  },
});
