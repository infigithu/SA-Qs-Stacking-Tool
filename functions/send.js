export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.GOOGLE_CREDENTIALS_JSON) {
      return json({ error: "Missing GOOGLE_CREDENTIALS_JSON environment variable." }, 500);
    }

    const body = await request.json();

    const questions = body.questions || [];
    const spreadsheetId = body.spreadsheet_id || env.GOOGLE_SPREADSHEET_ID;
    const sheetName = body.sheet_name || env.GOOGLE_SHEET_NAME || "Sheet1";

    if (!questions.length) {
      return json({ error: "No questions provided" }, 400);
    }

    if (!spreadsheetId) {
      return json({ error: "Missing spreadsheet_id" }, 400);
    }

    const accessToken = await getGoogleAccessToken(env);


    let sent = 0;
const telegramErrors = [];

for (const q of questions) {
  const hasFigures = Boolean(q.has_figures);

  const options = q.options || [];
  const optionsStr = Array.isArray(options) ? JSON.stringify(options) : String(options || "");

  const tags = q.tags || "";
  const tagsStr = Array.isArray(tags) ? tags.join(", ") : String(tags || "");

  const row = [
    q.title || "",
    q.chapter_title || "",
    q.subject || "",
    q.type || "",
    q.level || "",
    q.max_xp || "",
    q.statement || "",
    q.solution || "",
    q.hint || "",
    q.correct_answer || "",
    optionsStr,
    tagsStr,
    q.is_visible ?? true,
    q.is_formula ?? false,
    q.is_concept ?? false,
    q.is_pyq ?? false,
    q.pyq_exam || "",
    q.pyq_year || "",
    hasFigures,
  ];

  // First save to Google Sheets
  await appendRow(accessToken, spreadsheetId, sheetName, row);
  sent++;

  // Then try Telegram
  if (hasFigures) {
    try {
      const qImages = q.question_figures || [];
      const sImages = q.solution_figures || [];
      const title = q.title || "Untitled Question";

      await sendImagesToTelegram(env, title, qImages, sImages);
    } catch (err) {
      telegramErrors.push(`${q.title || "Untitled Question"}: ${err.message}`);
      console.error("Telegram failed:", err);
    }
  }
}

return json({
  sent,
  message: `${sent} question(s) saved to "${sheetName}"!`,
  telegram_errors: telegramErrors,
});
    

    // let sent = 0;

    // for (const q of questions) {
    //   const hasFigures = Boolean(q.has_figures);

    //   // if (hasFigures) {
    //   //   const qImages = q.question_figures || [];
    //   //   const sImages = q.solution_figures || [];
    //   //   const title = q.title || "Untitled Question";

    //   //   await sendImagesToTelegram(env, title, qImages, sImages);
    //   // }

    //   const options = q.options || [];
    //   const optionsStr = Array.isArray(options) ? JSON.stringify(options) : String(options || "");

    //   const tags = q.tags || "";
    //   const tagsStr = Array.isArray(tags) ? tags.join(", ") : String(tags || "");

    //   const row = [
    //     q.title || "",
    //     q.chapter_title || "",
    //     q.subject || "",
    //     q.type || "",
    //     q.level || "",
    //     q.max_xp || "",
    //     q.statement || "",
    //     q.solution || "",
    //     q.hint || "",
    //     q.correct_answer || "",
    //     optionsStr,
    //     tagsStr,
    //     q.is_visible ?? true,
    //     q.is_formula ?? false,
    //     q.is_concept ?? false,
    //     q.is_pyq ?? false,
    //     q.pyq_exam || "",
    //     q.pyq_year || "",
    //     hasFigures,
    //   ];

    //   await appendRow(accessToken, spreadsheetId, sheetName, row);
    //   sent++;
    // }

    // return json({
    //   sent,
    //   message: `${sent} question(s) saved to "${sheetName}"!`,
    // });
  } catch (error) {
    return json({ error: error.message || "Send failed" }, 500);
  }
}

async function appendRow(accessToken, spreadsheetId, sheetName, row) {
  const range = encodeURIComponent(`${sheetName}!A:S`);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to append row to Google Sheets");
  }

  return data;
}

async function sendImagesToTelegram(env, title, qImages, sImages) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return;
  }

  const allImages = [...qImages, ...sImages];

  if (!allImages.length) {
    return;
  }

  let displayTitle = title;

  if (qImages.length && sImages.length) {
    displayTitle = `${title} (Qs + Soln)`;
  } else if (qImages.length) {
    displayTitle = `${title} (Qs)`;
  } else if (sImages.length) {
    displayTitle = `${title} (Soln)`;
  }

  if (allImages.length === 1) {
    await sendSingleTelegramImage(env, displayTitle, allImages[0]);
  } else {
    await sendTelegramMediaGroup(env, displayTitle, allImages);
  }
}

// async function sendSingleTelegramImage(env, caption, imageB64) {
//   const form = new FormData();

//   form.append("chat_id", env.TELEGRAM_CHAT_ID);
//   form.append("caption", caption);
//   form.append("photo", base64ToBlob(imageB64), "image.jpg");

//   const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
//     method: "POST",
//     body: form,
//   });

//   if (!response.ok) {
//     const text = await response.text();
//     throw new Error(`Telegram sendPhoto failed: ${text}`);
//   }
// }


async function sendSingleTelegramImage(env, caption, imageB64) {
  const file = base64ToTelegramFile(imageB64, 0);

  if (file.size > 10 * 1024 * 1024) {
    throw new Error(`Image too large for Telegram photo: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
  }

  const form = new FormData();
  form.append("chat_id", env.TELEGRAM_CHAT_ID);
  form.append("caption", String(caption).slice(0, 1024));
  form.append("photo", file.blob, file.filename);

  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
    {
      method: "POST",
      body: form,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram sendPhoto failed: ${text}`);
  }
}



// async function sendTelegramMediaGroup(env, caption, images) {
//   const form = new FormData();

//   form.append("chat_id", env.TELEGRAM_CHAT_ID);

//   const media = images.map((_, index) => {
//     const item = {
//       type: "photo",
//       media: `attach://image_${index}.jpg`,
//     };

//     if (index === 0) {
//       item.caption = caption;
//     }

//     return item;
//   });

//   form.append("media", JSON.stringify(media));

//   images.forEach((imageB64, index) => {
//     form.append(`image_${index}.jpg`, base64ToBlob(imageB64), `image_${index}.jpg`);
//   });

//   const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
//     method: "POST",
//     body: form,
//   });

//   if (!response.ok) {
//     const text = await response.text();
//     throw new Error(`Telegram sendMediaGroup failed: ${text}`);
//   }
// }


async function sendTelegramMediaGroup(env, caption, images) {
  const form = new FormData();
  form.append("chat_id", env.TELEGRAM_CHAT_ID);

  const prepared = images.map((imageB64, index) => {
    const file = base64ToTelegramFile(imageB64, index);

    if (file.size > 10 * 1024 * 1024) {
      throw new Error(
        `Image ${index + 1} too large for Telegram photo: ${(file.size / 1024 / 1024).toFixed(2)} MB`
      );
    }

    return file;
  });

  const media = prepared.map((file, index) => {
    const attachName = `photo_${index}`;

    const item = {
      type: "photo",
      media: `attach://${attachName}`,
    };

    if (index === 0) {
      item.caption = String(caption).slice(0, 1024);
    }

    return item;
  });

  form.append("media", JSON.stringify(media));

  prepared.forEach((file, index) => {
    form.append(`photo_${index}`, file.blob, file.filename);
  });

  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMediaGroup`,
    {
      method: "POST",
      body: form,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram sendMediaGroup failed: ${text}`);
  }
}



// function base64ToBlob(b64) {
//   const clean = b64.includes(",") ? b64.split(",")[1] : b64;
//   const binary = atob(clean);
//   const bytes = new Uint8Array(binary.length);

//   for (let i = 0; i < binary.length; i++) {
//     bytes[i] = binary.charCodeAt(i);
//   }

//   return new Blob([bytes], {
//     type: "image/jpeg",
//   });
// }


function base64ToTelegramFile(b64, index = 0) {
  let mime = "image/jpeg";
  let clean = b64;

  if (typeof b64 === "string" && b64.startsWith("data:")) {
    const match = b64.match(/^data:(.*?);base64,(.*)$/);

    if (!match) {
      throw new Error("Invalid image data URL");
    }

    mime = match[1] || "image/jpeg";
    clean = match[2];
  }

  clean = clean.trim();

  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  let ext = "jpg";

  if (mime.includes("png")) ext = "png";
  else if (mime.includes("webp")) ext = "webp";
  else if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";

  return {
    blob: new Blob([bytes], { type: mime }),
    filename: `image_${index}.${ext}`,
    mime,
    size: bytes.length,
  };
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
