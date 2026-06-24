import http from "node:http";
import next from "next";

const hostname = process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    http.createServer((request, response) => {
      handle(request, response);
    }).listen(port, hostname, () => {
      console.log(`MExT FieldForce listening on http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error("[startup] FieldForce could not start.", error);
    process.exit(1);
  });
