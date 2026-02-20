import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import authService from '../services/authService.js';

const AuthContext = createContext(null);

/**
 * AuthProvider — wraps the app and provides current user state, login, logout, register
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // Initial auth-check loading

    // On mount: verify stored token and load user
    useEffect(() => {
        const token = localStorage.getItem('priosync_token');
        if (!token) {
            setLoading(false);
            return;
        }
        authService
            .getMe()
            .then(({ data }) => setUser(data.user))
            .catch(() => localStorage.removeItem('priosync_token'))
            .finally(() => setLoading(false));
    }, []);

    const register = useCallback(async (formData) => {
        const { data } = await authService.register(formData);
        localStorage.setItem('priosync_token', data.token);
        setUser(data.user);
        toast.success(`Welcome to PrioSync, ${data.user.name}! 🎉`);
        return data;
    }, []);

    const login = useCallback(async (formData) => {
        const { data } = await authService.login(formData);
        localStorage.setItem('priosync_token', data.token);
        setUser(data.user);
        toast.success(`Welcome back, ${data.user.name}! 👋`);
        return data;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('priosync_token');
        setUser(null);
        toast.info('Logged out successfully.');
    }, []);

    const updateUser = useCallback((updatedUser) => {
        setUser(updatedUser);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, register, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
