import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { GoalDetail } from './goal-detail/goal-detail';
import { GoalForm } from './goal-form/goal-form';
import { GoalsList } from './goals-list/goals-list';

/**
 * Routes live here rather than in a separate routing file. `goals/new` must come
 * before `goals/:id`, or "new" would be parsed as an id. withComponentInputBinding
 * lets GoalDetail take :id as a component input instead of subscribing to the route.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    provideRouter(
      [
        { path: '', component: GoalsList, title: 'Goals · Career OS' },
        { path: 'goals/new', component: GoalForm, title: 'New goal · Career OS' },
        { path: 'goals/:id', component: GoalDetail, title: 'Goal · Career OS' },
        { path: '**', redirectTo: '' },
      ],
      withComponentInputBinding(),
    ),
  ],
};
