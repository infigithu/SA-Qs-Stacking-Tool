export async function onRequestGet(context) {
  return new Response(
    JSON.stringify({
      sheets: ["Sheet1", "Questions", "Test"]
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
