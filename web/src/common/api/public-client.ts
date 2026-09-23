import createClient from "openapi-fetch";
import type { paths } from "@securepass/contracts";

import { API_BASE_URL } from "@/modules/auth/data";

// Sin retry ni Bearer automatico: login, refresh y logout.
export const publicApi = createClient<paths>({ baseUrl: API_BASE_URL });
