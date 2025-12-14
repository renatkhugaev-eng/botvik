// Server-Sent Events for real-time online player count
// Uses in-memory tracking (for production, use Redis)

// Track connected clients
const clients = new Set<ReadableStreamDefaultController>();

// Broadcast count to all clients
function broadcastCount() {
  const count = clients.size;
  const data = `data: ${JSON.stringify({ count })}\n\n`;
  
  clients.forEach((controller) => {
    try {
      controller.enqueue(new TextEncoder().encode(data));
    } catch {
      // Client disconnected
      clients.delete(controller);
    }
  });
}

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      // Add this client
      clients.add(controller);
      
      // Send initial count
      const initialData = `data: ${JSON.stringify({ count: clients.size })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initialData));
      
      // Notify all clients about new connection
      setTimeout(() => broadcastCount(), 100);
    },
    cancel(controller) {
      // Remove this client
      clients.delete(controller);
      
      // Notify all clients about disconnection
      setTimeout(() => broadcastCount(), 100);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for nginx
    },
  });
}

