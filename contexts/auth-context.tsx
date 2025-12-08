import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types/dslm';

type AuthContextType = {
    user: User | null;
    isLoading: boolean;
    login: (role: User['role']) => void;
    logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for stored session if needed, but for now we want the splash screen
        setIsLoading(false);
    }, []);

    const login = (role: User['role']) => {
        console.log(`[Auth] Logging in as ${role}...`);
        setIsLoading(true);
        setTimeout(() => {
            const newUser = {
                id: `USR-${Date.now()}`,
                name: role === 'ground-crew' ? 'Ground Control' : 'Astronaut',
                role,
                currentLocation: role === 'ground-crew' ? 'Earth' : 'Gateway',
            } as User;

            console.log(`[Auth] Login successful:`, newUser);
            setUser(newUser);
            setIsLoading(false);
        }, 500);
    };

    const logout = () => {
        console.log('[Auth] Logging out');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
