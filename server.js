const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
    process.loadEnvFile(envFile);
}

const host = "127.0.0.1";
const port = Number(process.env.PORT || 8000);
const allowedFiles = new Set(["index.html", "app.js", "firebase.js", "style.css"]);

function sendJson(response, status, data) {
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(data));
}

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${host}:${port}`);

    if (url.pathname === "/api/chat") {
        if (request.method !== "POST") {
            sendJson(response, 405, { error: "Method not allowed" });
            return;
        }

        if (!process.env.OPENAI_API_KEY) {
            sendJson(response, 503, { error: "Set OPENAI_API_KEY before starting the server." });
            return;
        }

        try {
            let body = "";
            for await (const chunk of request) {
                body += chunk;
                if (Buffer.byteLength(body) > 1_000_000) {
                    sendJson(response, 413, { error: "Request body is too large." });
                    return;
                }
            }

            const { messages } = JSON.parse(body);
            if (!Array.isArray(messages) || messages.length === 0) {
                sendJson(response, 400, { error: "A non-empty messages array is required." });
                return;
            }

            const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "You are NutriMind, an educational nutrition assistant. Give practical, balanced, nonjudgmental general information. Do not diagnose, prescribe treatment, or claim certainty about individual medical needs. For medical conditions, eating disorders, pregnancy, or personalized diet plans, recommend consulting a qualified healthcare professional. Be concise and explain uncertainty when relevant."
                        },
                        ...messages
                    ]
                })
            });
            const result = await openAiResponse.json();

            if (!openAiResponse.ok) {
                const message = result.error?.message || "The OpenAI request failed.";
                sendJson(response, openAiResponse.status, { error: message });
                return;
            }

            sendJson(response, 200, result);
        } catch (error) {
            if (error instanceof SyntaxError) {
                sendJson(response, 400, { error: "Request body must be valid JSON." });
                return;
            }
            console.error("Chat request failed:", error.message);
            sendJson(response, 502, { error: "Could not reach the chat service. Check the server output." });
        }
        return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405);
        response.end("Method not allowed");
        return;
    }

    const requestedFile = url.pathname === "/" ? "index.html" : path.basename(decodeURIComponent(url.pathname));
    if (!allowedFiles.has(requestedFile)) {
        response.writeHead(404);
        response.end("Not found");
        return;
    }

    const filePath = path.join(__dirname, requestedFile);
    fs.readFile(filePath, (error, content) => {
        if (error) {
            response.writeHead(500);
            response.end("Could not read the requested file.");
            return;
        }

        const contentTypes = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8"
        };
        response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] });
        response.end(request.method === "HEAD" ? undefined : content);
    });
});

server.listen(port, host, () => {
    console.log(`Nutrition Chatbot running at http://${host}:${port}`);
});
