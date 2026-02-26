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
    const [isLoading, setIsLoading] = useState(true);
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
                // Verify token with server
                const response = await fetch(`${getApiBaseUrlSync()}/api/auth/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                    setIsOfflineSession(false); // Connected to server
                } else {
                    // Token invalid, clear it
                    await SecureStore.deleteItemAsync('authToken');
                }
            }
        } catch (error) {
            console.log('Session check failed (server may be offline):', error);
            // If server is offline, try to load cached user data
            try {
                // First try SecureStore (last logged in user)
                const cachedUser = await SecureStore.getItemAsync('cachedUser');
                if (cachedUser) {
                    setUser(JSON.parse(cachedUser));
                    setIsOfflineSession(true);
                }
                // Note: We don't auto-login from database here since we need password verification
                // User must manually login with password to verify offline credentials
            } catch {
                // No cached user - user will need to login
            }
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (username: string, password: string): Promise<boolean> => {
        setIsLoading(true);
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
                setIsLoading(false);
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
            setIsLoading(false);
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
                    setIsLoading(false);
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
                        setIsLoading(false);
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
            setIsLoading(false);
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
                isLoading,
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
