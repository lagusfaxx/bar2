/**
 * Estado compartido por todos los formularios que usan `useActionState`.
 * Mantenerlo uniforme permite reutilizar los componentes de error y de aviso.
 */
export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  /** Errores por campo, tal como los devuelve `fieldErrors` de validation.ts */
  errors?: Record<string, string>;
  /** Datos extra que la acción quiera devolver a la vista. */
  data?: Record<string, unknown>;
};

export const IDLE: FormState = { status: "idle" };

export function formError(
  message: string,
  errors?: Record<string, string>,
): FormState {
  return { status: "error", message, errors };
}

export function formSuccess(
  message: string,
  data?: Record<string, unknown>,
): FormState {
  return { status: "success", message, data };
}
