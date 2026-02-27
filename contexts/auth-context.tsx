import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types/dslm';
import {
  getCachedUser,
  saveCachedUser,
  updateUserLastLogin,
  hashPassword,
  verifyPassword,
} from '../services/local-db';
import { getApiBaseUrlSync } from '../services/api-config';

type AuthContextType = {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isOfflineSession: boolean; // Indicates if logged in offline
    login: (username: string, password: string) => Promise<boolean>;
    loginError: string | null;
    logout: () => Promise<void>;
    getToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isOfflineSession, setIsOfflineSession] = useState(false);

    // Check for existing session on mount
    useEffect(() => {
        checkExistingSession();
    }, []);

    const checkExistingSession = async () => {
        try {
            const token = await SecureStore.getItemAsync('authToken');
            if (token) {
                // Verify token with server (5s timeout to avoid blocking login screen)
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);

                try {
                    const response = await fetch(`${getApiBaseUrlSync()}/api/auth/me`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        signal: controller.signal,
                    });
                    clearTimeout(timeout);

                    if (response.ok) {
                        const data = await response.json();
                        setUser(data.user);
                        setIsOfflineSession(false);
                    } else {
                        await SecureStore.deleteItemAsync('authToken');
                    }
                } catch {
                    clearTimeout(timeout);
                    throw new Error('Server unreachable');
                }
            }
        } catch (error) {
            console.log('Session check failed (server may be offline):', error);
            try {
                const cachedUser = await SecureStore.getItemAsync('cachedUser');
                if (cachedUser) {
                    setUser(JSON.parse(cachedUser));
                    setIsOfflineSession(true);
                }
            } catch {
                // No cached user
            }
        } finally {
            setIsCheckingSession(false);
        }
    };

    const login = async (username: string, password: string): Promise<boolean> => {
        setIsLoggingIn(true);
        setLoginError(null);

        try {
            const response = await fetch(`${getApiBaseUrlSync()}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setLoginError(data.error || 'Login failed');
                setIsLoggingIn(false);
                return false;
            }

            // Store token securely
            await SecureStore.setItemAsync('authToken', data.token);

            // Cache user data for offline access (SecureStore for quick access)
            await SecureStore.setItemAsync('cachedUser', JSON.stringify(data.user));

            // Also store in local SQLite database with password hash for offline login
            try {
                const passwordHashValue = hashPassword(password);
                await saveCachedUser(data.user, passwordHashValue);
            } catch (dbError) {
                console.log('Failed to cache user in local database:', dbError);
            }

            setUser(data.user);
            setIsOfflineSession(false); // Successfully connected to server
            setIsLoggingIn(false);
            return true;
        } catch (error) {
            // Server is offline, attempt offline login with cached credentials
            console.log('Server unreachable, attempting offline login');

            try {
                // First try local SQLite database (has password hash for verification)
                const cachedDbUser = await getCachedUser(username);
                if (cachedDbUser && verifyPassword(password, cachedDbUser.passwordHash)) {
                    const userData: User = {
                        id: cachedDbUser.id,
                        username: cachedDbUser.username,
                        name: cachedDbUser.name,
                        role: cachedDbUser.role as User['role'],
                        currentLocation: cachedDbUser.currentLocation,
                    };
                    await updateUserLastLogin(username);
                    setUser(userData);
                    setIsOfflineSession(true);
                    setIsLoggingIn(false);
                    // No error - offline login is expected behavior for astronauts
                    return true;
                }

                // Fallback: check SecureStore (for backwards compatibility)
                const cachedUser = await SecureStore.getItemAsync('cachedUser');
                if (cachedUser) {
                    const userData = JSON.parse(cachedUser);
                    // Legacy check - just match username (will upgrade to DB on next online login)
                    if (userData.username === username.toLowerCase()) {
                        setUser(userData);
                        setIsOfflineSession(true);
                        setIsLoggingIn(false);
                        return true;
                    }
                }
            } catch {
                // No cached credentials
            }

            // Check if we have any cached user at all for better error message
            const hasCachedUser = await getCachedUser(username).catch(() => null);
            if (hasCachedUser) {
                setLoginError('Incorrect password for offline login.');
            } else {
                setLoginError('No offline credentials found. Please connect to the server for first login.');
            }
            setIsLoggingIn(false);
            return false;
        }
    };

    const logout = async () => {
        const token = await SecureStore.getItemAsync('authToken');

        // Try to logout from server
        if (token) {
            try {
                await fetch(`${getApiBaseUrlSync()}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
            } catch {
                // Server offline, just clear locally
            }
        }

        // Clear local data
        await SecureStore.deleteItemAsync('authToken');
        await SecureStore.deleteItemAsync('cachedUser');

        setUser(null);
        setLoginError(null);
        setIsOfflineSession(false);
    };

    const getToken = async (): Promise<string | null> => {
        return SecureStore.getItemAsync('authToken');
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading: isLoggingIn,
                isAuthenticated: !!user,
                isOfflineSession,
                login,
                loginError,
                logout,
                getToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
