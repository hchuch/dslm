import { useEffect, useState, useCallback } from 'react';

// Types for NFC operations
export type ScannedTag = {
    id: string;
    type: string;
    payload?: string;
};

export type WriteResult = {
    success: boolean;
    tagId?: string;
    error?: string;
};

// Safe wrapper for NFC Manager
let NfcManager: any = null;
let NfcTech: any = null;
let Ndef: any = null;

try {
    // Try to require the module safely
    const nfcModule = require('react-native-nfc-manager');
    NfcManager = nfcModule.default;
    NfcTech = nfcModule.NfcTech;
    Ndef = nfcModule.Ndef;
} catch (e) {
    console.warn('NFC Manager could not be loaded. Native module missing?');
}

export function useNFC() {
    const [isSupported, setIsSupported] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isWriting, setIsWriting] = useState(false);

    useEffect(() => {
        async function checkNfc() {
            if (!NfcManager) {
                setIsSupported(false);
                return;
            }

            try {
                const supported = await NfcManager.isSupported();
                setIsSupported(supported);
                if (supported) {
                    await NfcManager.start();
                    const enabled = await NfcManager.isEnabled();
                    setIsEnabled(enabled);
                }
            } catch (e) {
                console.warn('Error initializing NFC:', e);
                setIsSupported(false);
            }
        }
        checkNfc();

        return () => {
            if (NfcManager) {
                NfcManager.cancelTechnologyRequest().catch(() => 0);
            }
        };
    }, []);

    const scanTag = useCallback(async (): Promise<ScannedTag | null> => {
        if (!isSupported || !NfcManager) {
            console.warn('[NFC] Not supported or not loaded on this device');
            return null;
        }

        try {
            console.log('[NFC] Starting scan request...');
            setIsScanning(true);
            // Request technology (NDEF is most common)
            await NfcManager.requestTechnology(NfcTech.Ndef);

            const tag = await NfcManager.getTag();
            console.log('[NFC] Tag found:', tag);

            // Try to read NDEF message if available
            let payload = tag.id;
            try {
                const ndefRecords = tag.ndefMessage;
                if (ndefRecords && ndefRecords.length > 0) {
                    // Try to decode the first text record
                    const record = ndefRecords[0];
                    if (record.payload && record.payload.length > 0) {
                        // Skip the first byte (language code length) and decode
                        const langCodeLength = record.payload[0];
                        const textBytes = record.payload.slice(1 + langCodeLength);
                        payload = String.fromCharCode(...textBytes);
                    }
                }
            } catch (e) {
                // NDEF read failed, use tag ID
                console.log('[NFC] Could not read NDEF, using tag ID');
            }

            return {
                id: tag.id || 'UNKNOWN',
                type: 'NFC',
                payload: payload,
            };
        } catch (ex) {
            console.warn('[NFC] Scan Error or Cancelled:', ex);
            return null;
        } finally {
            // Stop scanning
            if (NfcManager) {
                NfcManager.cancelTechnologyRequest().catch(() => 0);
            }
            setIsScanning(false);
            console.log('[NFC] Scan session ended');
        }
    }, [isSupported]);

    const writeTag = useCallback(async (data: string): Promise<WriteResult> => {
        if (!isSupported || !NfcManager) {
            console.warn('[NFC] Not supported or not loaded on this device');
            return { success: false, error: 'NFC not supported' };
        }

        try {
            console.log('[NFC] Starting write request for:', data);
            setIsWriting(true);

            // Request NDEF technology
            await NfcManager.requestTechnology(NfcTech.Ndef);

            const tag = await NfcManager.getTag();
            console.log('[NFC] Tag for write:', tag);

            // Create NDEF message with the CTB/Item ID
            const bytes = Ndef.encodeMessage([
                Ndef.textRecord(data),
            ]);

            if (bytes) {
                await NfcManager.ndefHandler.writeNdefMessage(bytes);
                console.log('[NFC] Write successful');
                return { success: true, tagId: tag.id };
            } else {
                return { success: false, error: 'Failed to encode NDEF message' };
            }
        } catch (ex: any) {
            console.warn('[NFC] Write Error:', ex);
            return { success: false, error: ex.message || 'Write failed' };
        } finally {
            if (NfcManager) {
                NfcManager.cancelTechnologyRequest().catch(() => 0);
            }
            setIsWriting(false);
            console.log('[NFC] Write session ended');
        }
    }, [isSupported]);

    const cancelScan = useCallback(async () => {
        console.log('[NFC] Cancelling operation...');
        if (NfcManager) {
            await NfcManager.cancelTechnologyRequest().catch(() => 0);
        }
        setIsScanning(false);
        setIsWriting(false);
    }, []);

    return {
        isSupported,
        isEnabled,
        isScanning,
        isWriting,
        scanTag,
        writeTag,
        cancelScan,
    };
}
