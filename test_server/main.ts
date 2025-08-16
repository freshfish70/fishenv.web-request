import { Hono } from 'hono';

const app = new Hono();

/**
 * GET
 */
app.get('/get', (c) =>
  c.json({
    message: 'This is a GET request',
    data: 'Sample data'
  }));

/**
 * POST
 */
app.post('/post', async (c) => {
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate delay
  console.log('== POST request received');
  const body = await c.req.json();
  console.log('== body:\n', body, '\n');
  console.log('== headers:\n', c.req.header());

  // if (Math.random() < 0.9) {
  //   console.log("== Simulating error");
  //   return c.json({
  //     error: "Simulated error occurred",
  //   }, 500);
  // }

  return c.json({
    message: 'This is a POST request',
    data: 'Sample data'
  });
});

Deno.serve({ port: 5555 }, app.fetch);
