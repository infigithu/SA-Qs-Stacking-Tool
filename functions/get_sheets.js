export async function onRequestGet(context) {
  return json({
    sheets: ["Sheet1", "Questions", "Test"]
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
