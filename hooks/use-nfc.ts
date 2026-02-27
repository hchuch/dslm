import { useEffect, useState, useCallback } from 'react';

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

let NfcManager: any = null;
let NfcTech: any = null;
let Ndef: any = null;

try {
    const nfcModule = require('react-native-nfc-manager');
    NfcManager = nfcModule.default;
    NfcTech = nfcModule.NfcTech;
    Ndef = nfcModule.Ndef;
} catch (e) {
    // NFC native module not available
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
        if (!isSupported || !NfcManager) return null;

        try {
            setIsScanning(true);
            await NfcManager.requestTechnology(NfcTech.Ndef);

            const tag = await NfcManager.getTag();

            let payload = tag.id;
            try {
                const ndefRecords = tag.ndefMessage;
                if (ndefRecords && ndefRecords.length > 0) {
                    const record = ndefRecords[0];
                    if (record.payload && record.payload.length > 0) {
                        const langCodeLength = record.payload[0];
                        const textBytes = record.payload.slice(1 + langCodeLength);
                        payload = String.fromCharCode(...textBytes);
                    }
                }
            } catch (e) {
                // NDEF read failed, fall back to tag ID
            }

            return {
                id: tag.id || 'UNKNOWN',
                type: 'NFC',
                payload: payload,
            };
        } catch (ex) {
            return null;
        } finally {
            if (NfcManager) {
                NfcManager.cancelTechnologyRequest().catch(() => 0);
            }
            setIsScanning(false);
        }
    }, [isSupported]);

    const writeTag = useCallback(async (data: string): Promise<WriteResult> => {
        if (!isSupported || !NfcManager) {
            return { success: false, error: 'NFC not supported' };
        }

        try {
            setIsWriting(true);
            await NfcManager.requestTechnology(NfcTech.Ndef);

            const tag = await NfcManager.getTag();

            const bytes = Ndef.encodeMessage([
                Ndef.textRecord(data),
            ]);

            if (bytes) {
                await NfcManager.ndefHandler.writeNdefMessage(bytes);
                return { success: true, tagId: tag.id };
            } else {
                return { success: false, error: 'Failed to encode NDEF message' };
            }
        } catch (ex: any) {
            return { success: false, error: ex.message || 'Write failed' };
        } finally {
            if (NfcManager) {
                NfcManager.cancelTechnologyRequest().catch(() => 0);
            }
            setIsWriting(false);
        }
    }, [isSupported]);

    const cancelScan = useCallback(async () => {
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
