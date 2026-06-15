import { openSurveyHttpAdapter } from './openSurveyHttpAdapter';

// Single registration point: swap this one line to change all data behaviour
// (e.g. a mock adapter for tests). Hooks/components import `openSurveyRepository`
// from here — never the concrete adapter directly.
export const openSurveyRepository = openSurveyHttpAdapter;
