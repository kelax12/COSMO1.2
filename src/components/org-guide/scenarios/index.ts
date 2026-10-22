// src/components/org-guide/scenarios/index.ts
import type { GuideAction, GuideCategory } from '../guide-types';
import { PEOPLE_ACTIONS } from './people';
import { ROLES_ACTIONS } from './roles';
import { STEER_ACTIONS } from './steer';
import { WORK_ACTIONS } from './work';

export const GUIDE_CATEGORIES: GuideCategory[] = ['work', 'people', 'roles', 'steer'];

export const GUIDE_ACTIONS: GuideAction[] = [...WORK_ACTIONS, ...PEOPLE_ACTIONS, ...ROLES_ACTIONS, ...STEER_ACTIONS];
