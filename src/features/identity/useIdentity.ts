import { useCallback, useState } from "react";
import {
  getOrCreateClientId,
  getStoredName,
  setStoredName,
} from "../../lib/identityStore";

/**
 * The visitor's browser identity: a stable `clientId` and the globally
 * remembered display name (reused across Rooms). Renaming persists immediately.
 */
export function useIdentity() {
  const [clientId] = useState(getOrCreateClientId);
  const [name, setNameState] = useState<string | null>(getStoredName);

  const setName = useCallback((next: string) => {
    setStoredName(next);
    setNameState(next);
  }, []);

  return { clientId, name, setName };
}
