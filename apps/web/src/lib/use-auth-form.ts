import type { RefObject } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import {
  type AuthClientError,
  type MapAuthClientErrorOptions,
  type MappedAuthError,
  mapAuthClientError,
} from "./auth-errors";

export interface UseAuthFormOptions {
  errorId: string;
  /** Always-on aria-describedby ids (e.g. password hint), keyed by field name. */
  persistentDescribedBy?: Record<string, string>;
}

export interface AuthFieldAriaProps {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export interface UseAuthFormResult {
  busy: boolean;
  clearError: () => void;
  error: MappedAuthError | null;
  errorId: string;
  errorRef: RefObject<HTMLElement | null>;
  formProps: {
    "aria-busy"?: boolean;
  };
  getFieldProps: (fieldName: string) => AuthFieldAriaProps;
  setBusy: (busy: boolean) => void;
  showError: (
    clientError: AuthClientError | null | undefined,
    mapOptions?: MapAuthClientErrorOptions
  ) => void;
  showMappedError: (mapped: MappedAuthError) => void;
}

/**
 * Shared busy / error / a11y state for Better Auth Preact form islands.
 */
export function useAuthForm(options: UseAuthFormOptions): UseAuthFormResult {
  const { errorId, persistentDescribedBy = {} } = options;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MappedAuthError | null>(null);
  const errorRef = useRef<HTMLElement | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const showMappedError = useCallback((mapped: MappedAuthError) => {
    setError(mapped);
  }, []);

  const showError = useCallback(
    (
      clientError: AuthClientError | null | undefined,
      mapOptions?: MapAuthClientErrorOptions
    ) => {
      setError(mapAuthClientError(clientError, mapOptions));
    },
    []
  );

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  const getFieldProps = useCallback(
    (fieldName: string): AuthFieldAriaProps => {
      const persistent = persistentDescribedBy[fieldName];
      if (!error) {
        return persistent ? { "aria-describedby": persistent } : {};
      }
      const describedBy = persistent ? `${persistent} ${errorId}` : errorId;
      return {
        "aria-describedby": describedBy,
        "aria-invalid": true,
      };
    },
    [error, errorId, persistentDescribedBy]
  );

  return {
    busy,
    clearError,
    error,
    errorId,
    errorRef,
    formProps: {
      "aria-busy": busy || undefined,
    },
    getFieldProps,
    setBusy,
    showError,
    showMappedError,
  };
}
