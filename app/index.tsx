import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '../components/themed-text';
import { useAuth } from '../contexts/auth-context';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const handleRoleSelect = (role: 'ground-crew' | 'astronaut') => {
    login(role);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
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
          <ThemedText style={styles.instruction}>Select Mission Profile</ThemedText>
        </View>

        <View style={styles.cardsContainer}>
          {/* Ground Crew Card */}
          <Pressable
            style={({ pressed }) => [styles.card, styles.cardGround, pressed && styles.cardPressed]}
            onPress={() => handleRoleSelect('ground-crew')}
          >
            <View style={[styles.iconContainer, styles.iconGround]}>
              <Ionicons name="planet" size={32} color="#EAB308" />
            </View>
            <View style={styles.cardContent}>
              <ThemedText style={styles.cardTitle}>Ground Crew</ThemedText>
              <ThemedText style={styles.cardDesc}>
                Launch coordination & manifest preparation
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#444" />
          </Pressable>

          {/* Astronaut Card */}
          <Pressable
            style={({ pressed }) => [styles.card, styles.cardSpace, pressed && styles.cardPressed]}
            onPress={() => handleRoleSelect('astronaut')}
          >
            <View style={[styles.iconContainer, styles.iconSpace]}>
              <Ionicons name="rocket" size={32} color="#0F6FFF" />
            </View>
            <View style={styles.cardContent}>
              <ThemedText style={styles.cardTitle}>Astronaut</ThemedText>
              <ThemedText style={styles.cardDesc}>
                Inventory management & module inspection
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#444" />
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>System Version 2.4.1</ThemedText>
        <ThemedText style={styles.footerSubText}>NASA Gateway Program</ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
  },
  subtitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: -5,
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
  cardsContainer: {
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  cardGround: {
    borderLeftWidth: 4,
    borderLeftColor: '#EAB308',
  },
  cardSpace: {
    borderLeftWidth: 4,
    borderLeftColor: '#0F6FFF',
  },
  cardPressed: {
    backgroundColor: '#1A1A1A',
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    backgroundColor: '#1A1A1A',
  },
  iconGround: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
  },
  iconSpace: {
    backgroundColor: 'rgba(15, 111, 255, 0.1)',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
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
});