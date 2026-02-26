import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Modal,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';

import { Colors } from '../constants/colors';
import { useNFC, ScannedTag, WriteResult } from '../hooks/use-nfc';
import { ThemedText } from './themed-text';

type Mode = 'scan' | 'write';

type Props = {
    visible: boolean;
    mode: Mode;
    writeData?: string; // Data to write when in write mode (e.g., CTB ID)
    title?: string;
    subtitle?: string;
    onClose: () => void;
    onScanSuccess?: (tag: ScannedTag) => void;
    onWriteSuccess?: (result: WriteResult) => void;
};

export function NFCScannerModal({
    visible,
    mode,
    writeData,
    title,
    subtitle,
    onClose,
    onScanSuccess,
    onWriteSuccess,
}: Props) {
    const { isSupported, isEnabled, isScanning, isWriting, scanTag, writeTag, cancelScan } = useNFC();
    const [status, setStatus] = useState<'ready' | 'scanning' | 'success' | 'error'>('ready');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [scaleAnim] = useState(new Animated.Value(1));
    const [pulseAnim] = useState(new Animated.Value(0.3));

    // Pulse animation for scanning state
    useEffect(() => {
        if (status === 'scanning') {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 0.3,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [status, pulseAnim]);

    // Auto-start scanning when modal opens
    useEffect(() => {
        if (visible && isSupported && isEnabled) {
            handleStartOperation();
        }
        return () => {
            if (visible) {
                cancelScan();
            }
        };
    }, [visible]);

    const handleStartOperation = async () => {
        setStatus('scanning');
        setErrorMessage(null);

        if (mode === 'scan') {
            const tag = await scanTag();
            if (tag) {
                setStatus('success');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // Animate success
                Animated.sequence([
                    Animated.timing(scaleAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
                    Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
                ]).start();

                setTimeout(() => {
                    onScanSuccess?.(tag);
                    onClose();
                }, 800);
            } else {
                setStatus('ready');
            }
        } else if (mode === 'write' && writeData) {
            const result = await writeTag(writeData);
            if (result.success) {
                setStatus('success');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Animated.sequence([
                    Animated.timing(scaleAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
                    Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
                ]).start();

                setTimeout(() => {
                    onWriteSuccess?.(result);
                    onClose();
                }, 800);
            } else {
                setStatus('error');
                setErrorMessage(result.error || 'Failed to write to tag');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        }
    };

    const handleCancel = () => {
        cancelScan();
        setStatus('ready');
        onClose();
    };

    const handleRetry = () => {
        handleStartOperation();
    };

    const defaultTitle = mode === 'scan' ? 'Scan NFC Tag' : 'Assign NFC Tag';
    const defaultSubtitle = mode === 'scan'
        ? 'Hold your device near the NFC tag'
        : `Hold your device near the NFC tag to assign: ${writeData}`;

    const getStatusIcon = () => {
        switch (status) {
            case 'success':
                return <Ionicons name="checkmark-circle" size={64} color={Colors.success} />;
            case 'error':
                return <Ionicons name="close-circle" size={64} color={Colors.error} />;
            default:
                return <Ionicons name="radio-outline" size={64} color={Colors.blue} />;
        }
    };

    const getStatusMessage = () => {
        switch (status) {
            case 'scanning':
                return mode === 'scan' ? 'Scanning...' : 'Writing...';
            case 'success':
                return mode === 'scan' ? 'Tag Found!' : 'Tag Assigned!';
            case 'error':
                return errorMessage || 'Operation failed';
            default:
                return 'Ready';
        }
    };

    if (!isSupported) {
        return (
            <Modal
                visible={visible}
                animationType="fade"
                transparent
                onRequestClose={onClose}
            >
                <Pressable style={styles.overlay} onPress={onClose}>
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="warning" size={64} color={Colors.warning} />
                        </View>
                        <ThemedText style={styles.title}>NFC Not Available</ThemedText>
                        <ThemedText style={styles.subtitle}>
                            This device doesn't support NFC or NFC is disabled.
                        </ThemedText>
                        <Pressable style={styles.closeButton} onPress={onClose}>
                            <ThemedText style={styles.closeButtonText}>Close</ThemedText>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
        );
    }

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={handleCancel}
        >
            <Pressable style={styles.overlay} onPress={handleCancel}>
                <Pressable style={styles.content} onPress={() => {}}>
                    {/* Icon with animation */}
                    <Animated.View
                        style={[
                            styles.iconContainer,
                            { transform: [{ scale: scaleAnim }] }
                        ]}
                    >
                        {status === 'scanning' && (
                            <Animated.View
                                style={[
                                    styles.pulseRing,
                                    { opacity: pulseAnim }
                                ]}
                            />
                        )}
                        {getStatusIcon()}
                        {status === 'scanning' && (
                            <ActivityIndicator
                                style={styles.spinner}
                                color={Colors.blue}
                                size="small"
                            />
                        )}
                    </Animated.View>

                    {/* Title & Subtitle */}
                    <ThemedText style={styles.title}>
                        {title || defaultTitle}
                    </ThemedText>
                    <ThemedText style={styles.subtitle}>
                        {status === 'error' ? errorMessage : (subtitle || defaultSubtitle)}
                    </ThemedText>

                    {/* Status indicator */}
                    <View style={[
                        styles.statusBadge,
                        status === 'success' && styles.statusBadgeSuccess,
                        status === 'error' && styles.statusBadgeError,
                    ]}>
                        <ThemedText style={styles.statusText}>
                            {getStatusMessage()}
                        </ThemedText>
                    </View>

                    {/* Write data preview (for write mode) */}
                    {mode === 'write' && writeData && status !== 'success' && (
                        <View style={styles.dataPreview}>
                            <ThemedText style={styles.dataPreviewLabel}>Writing:</ThemedText>
                            <ThemedText style={styles.dataPreviewValue}>{writeData}</ThemedText>
                        </View>
                    )}

                    {/* Action buttons */}
                    <View style={styles.buttons}>
                        {status === 'error' ? (
                            <>
                                <Pressable style={styles.retryButton} onPress={handleRetry}>
                                    <Ionicons name="refresh" size={18} color={Colors.blue} />
                                    <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
                                </Pressable>
                                <Pressable style={styles.cancelButton} onPress={handleCancel}>
                                    <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                                </Pressable>
                            </>
                        ) : status !== 'success' && (
                            <Pressable style={styles.cancelButton} onPress={handleCancel}>
                                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                            </Pressable>
                        )}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 32,
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.blueGlow,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        position: 'relative',
    },
    pulseRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 3,
        borderColor: Colors.blue,
    },
    spinner: {
        position: 'absolute',
        bottom: -8,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    statusBadge: {
        backgroundColor: Colors.blueGlow,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 24,
    },
    statusBadgeSuccess: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    statusBadgeError: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    dataPreview: {
        backgroundColor: Colors.background,
        borderRadius: 10,
        padding: 12,
        width: '100%',
        marginBottom: 20,
    },
    dataPreviewLabel: {
        fontSize: 11,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    dataPreviewValue: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.blue,
        fontFamily: 'monospace',
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        backgroundColor: Colors.background,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    retryButton: {
        flex: 1,
        backgroundColor: Colors.blueGlow,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.blue,
    },
    retryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.blue,
    },
    closeButton: {
        backgroundColor: Colors.blue,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        marginTop: 16,
    },
    closeButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
