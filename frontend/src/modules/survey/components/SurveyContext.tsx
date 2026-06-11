'use client';

import React, { createContext, useContext, useEffect } from 'react';
import type { SurveyContextType, SurveyFormData } from '../types';
import { surveyRepository } from '../adapters';
import { useSurvey } from '../hooks';

const SurveyContextComponent = createContext<SurveyContextType | undefined>(undefined);

export function SurveyProvider({ children }: { children: React.ReactNode }) {
    const { form } = useSurvey();

    useEffect(() => {
        // Preload events on mount
        const load = async () => {
            try {
                await surveyRepository.fetchEvents();
            } catch {
                // Preload is best-effort; the form fetches events again when rendered.
            }
        };
        load();
    }, []);

    const formValues = form.getValues();

    const value: SurveyContextType = {
        formData: {
            eventId: formValues.eventId,
            organizationId: formValues.organizationId,
            sportIds: formValues.sportIds || [],
        },
        setFields: (fields: Partial<SurveyFormData>) => {
            Object.entries(fields).forEach(([key, value]) => {
                form.setValue(key as keyof SurveyFormData, value);
            });
        },
        reset: form.reset,
    };

    return (
        <SurveyContextComponent.Provider value={value}>
            {children}
        </SurveyContextComponent.Provider>
    );
}

export function useSurveyContext() {
    const context = useContext(SurveyContextComponent);
    if (!context) {
        throw new Error('useSurveyContext must be used within SurveyProvider');
    }
    return context;
}
