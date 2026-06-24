export async function onRequestPost(context) {
  return json({
    error: "The /generate function is not connected yet."
  }, 501);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
