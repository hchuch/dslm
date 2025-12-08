import { useEffect, useState } from 'react';

// Mock types since we can't import from the library if it's missing
export type ScannedTag = {
    id: string;
    type: string;
    payload?: string;
};

// Safe wrapper for NFC Manager
let NfcManager: any = null;
let NfcTech: any = null;

try {
    // Try to require the module safely
    const nfcModule = require('react-native-nfc-manager');
    NfcManager = nfcModule.default;
    NfcTech = nfcModule.NfcTech;
} catch (e) {
    console.warn('NFC Manager could not be loaded. Native module missing?');
}

export function useNFC() {
    const [isSupported, setIsSupported] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

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

    const scanTag = async (): Promise<ScannedTag | null> => {
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

            return {
                id: tag.id || 'UNKNOWN',
                type: 'NFC',
                payload: tag.id,
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
    };

    const cancelScan = async () => {
        console.log('[NFC] Cancelling scan...');
        if (NfcManager) {
            await NfcManager.cancelTechnologyRequest().catch(() => 0);
        }
        setIsScanning(false);
    };

    return {
        isSupported,
        isEnabled,
        isScanning,
        scanTag,
        cancelScan,
    };
}
