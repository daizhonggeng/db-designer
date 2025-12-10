import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
    const [dbDialect, setDbDialect] = useState(() => {
        return localStorage.getItem('dbDialect') || 'mysql';
    });

    useEffect(() => {
        localStorage.setItem('dbDialect', dbDialect);
    }, [dbDialect]);

    return (
        <SettingsContext.Provider value={{ dbDialect, setDbDialect }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    return useContext(SettingsContext);
}
