/**
 * Action protocol types used by bot-side tools.
 * These mirror the types in the add-in and SaaS handler.
 */

export type OfficeAppType = "excel" | "word" | "outlook" | "powerpoint";

export interface OfficeAction {
	id: string;
	app: OfficeAppType;
	operation: string;
	params: Record<string, unknown>;
	description?: string;
}

export interface OfficeActionBatch {
	actions: OfficeAction[];
	explanation?: string;
	requiresConfirmation?: boolean;
}

export function createAction(
	app: OfficeAppType,
	operation: string,
	params: Record<string, unknown>,
	description?: string,
): OfficeAction {
	return {
		id: crypto.randomUUID(),
		app,
		operation,
		params,
		description,
	};
}

export function createBatch(
	actions: OfficeAction[],
	explanation?: string,
	requiresConfirmation = false,
): OfficeActionBatch {
	return { actions, explanation, requiresConfirmation };
}
