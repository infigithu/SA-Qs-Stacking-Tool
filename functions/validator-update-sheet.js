export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.GOOGLE_CREDENTIALS_JSON) {
      return json({ error: "Missing GOOGLE_CREDENTIALS_JSON" }, 500);
    }

    const body = await request.json();

    const spreadsheetId = body.spreadsheet_id;
    const sheetName = body.sheet_name || "Sheet1";
    const headers = body.headers || [];
    const rows = body.rows || [];

    if (!spreadsheetId) {
      return json({ error: "Missing spreadsheet_id" }, 400);
    }

    if (!headers.length) {
      return json({ error: "Missing headers" }, 400);
    }

    if (!rows.length) {
      return json({ error: "No changed rows provided" }, 400);
    }

    const accessToken = await getGoogleAccessToken(env);

    const batchData = [];

    for (const row of rows) {
      const rowNumber = row.__rowNumber;

      if (!rowNumber) continue;

      const cleanHeaders = headers.filter(header => header !== "__rowNumber");

      const values = cleanHeaders.map(header => row[header] ?? "");

      batchData.push({
        range: `${sheetName}!A${rowNumber}:${columnLetter(cleanHeaders.length)}${rowNumber}`,
        values: [values],
      });
    }

    if (!batchData.length) {
      return json({ error: "No valid rows to update" }, 400);
    }

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: batchData,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return json(
        { error: result.error?.message || "Failed to update sheet" },
        response.status
      );
    }

    return json({
      updated: rows.length,
      message: `${rows.length} changed row(s) updated in Google Sheet.`,
      details: result,
    });
  } catch (error) {
    return json(
      { error: error.message || "Failed to update validator sheet" },
      500
    );
  }
}

function columnLetter(columnNumber) {
  let temp;
  let letter = "";

  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }

  return letter;
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
    scope: "https://www.googleapis.com/auth/spreadsheets",
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
