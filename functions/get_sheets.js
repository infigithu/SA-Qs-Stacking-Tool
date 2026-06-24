export async function onRequestGet(context) {
  try {
    const { request, env } = context;

    if (!env.GOOGLE_CREDENTIALS_JSON) {
      return json({ error: "Missing GOOGLE_CREDENTIALS_JSON environment variable." }, 500);
    }

    const url = new URL(request.url);
    const spreadsheetId = url.searchParams.get("spreadsheet_id") || env.GOOGLE_SPREADSHEET_ID;

    if (!spreadsheetId) {
      return json({ error: "Missing spreadsheet_id" }, 400);
    }

    const accessToken = await getGoogleAccessToken(env);

    const sheetsRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await sheetsRes.json();

    if (!sheetsRes.ok) {
      return json({ error: data.error?.message || "Failed to fetch sheets" }, 500);
    }

    const sheets = data.sheets?.map((s) => s.properties.title) || [];

    return json({ sheets });
  } catch (error) {
    return json({ error: error.message || "Failed to fetch sheets" }, 500);
  }
}

async function getGoogleAccessToken(env) {
  const credentials = JSON.parse(env.GOOGLE_CREDENTIALS_JSON);

  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const jwt = await signJwt(header, payload, credentials.private_key);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    throw new Error(tokenData.error_description || "Google auth failed");
  }

  return tokenData.access_token;
}

async function signJwt(header, payload, privateKeyPem) {
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const key = await importPrivateKey(privateKeyPem);

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  return `${unsignedToken}.${base64urlArrayBuffer(signature)}`;
}

async function importPrivateKey(pem) {
  const cleanPem = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binary = atob(cleanPem);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
}

function base64url(input) {
  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlArrayBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
