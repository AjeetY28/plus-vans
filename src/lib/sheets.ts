export interface SheetsSubmitPayload {
  contactName: string;
  companyName?: string;
  phoneNumber: string;
  email: string;
  collectionDate?: string | null; // ISO string
  collectionTime?: string;
  postcode?: string;
  addressLine1?: string;
  addressLine2?: string;
  town?: string;
  county?: string;
  sameContact?: boolean;
  collectionContactName?: string;
  collectionPhoneNumber?: string;
  notificationMethods: string[];
  jobDescription: string;
  specialInstructions?: string;
  urgentJob: boolean;
}

export async function submitBookingToGoogleSheets(
  payload: SheetsSubmitPayload
): Promise<void> {
  const baseUrl = import.meta.env.VITE_SHEETS_WEB_APP_URL as string | undefined;
  if (!baseUrl) {
    throw new Error("VITE_SHEETS_WEB_APP_URL is not set");
  }

  const url = baseUrl.endsWith("/exec")
    ? baseUrl
    : `${baseUrl.replace(/\/$/, "")}/exec`;

  // Send raw JSON because Apps Script expects JSON.parse(requestBody)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }

    // Apps Script commonly returns { ok: boolean, error?: string }
    try {
      const json = await res.json();
      if (json && json.ok === false) {
        throw new Error(json.error || "Apps Script reported an error");
      }
    } catch {
      // If response isn't JSON, continue silently
    }

    return;
  } catch (err) {
    // Fallback: fire-and-forget with opaque request in case CORS blocks readable response
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(payload),
    });
    return;
  }
}
