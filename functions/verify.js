export async function onRequestPost(context) {
  return json({
    correct: false,
    explanation: "The /verify function is not connected yet."
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
