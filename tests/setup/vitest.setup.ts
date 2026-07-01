// ── Lifecycle de MSW para cada archivo de test ─────────────────────────────
// `onUnhandledRequest: "error"` = cualquier fetch real (no mockeado) tumba el
// test. Es la garantía dura de aislamiento: imposible tocar prod por accidente.
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw.server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
