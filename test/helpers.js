const http = require("http");

// เซิร์ฟเวอร์จำลองของ "บริการภายนอก" สำหรับทดสอบ retry/timeout/fallback
// handler(req, res, hitNumber) ตอบอะไรก็ได้ตามสถานการณ์ที่ต้องการจำลอง
function startFakeServer(handler) {
  const state = { hits: 0, urls: [] };
  const server = http.createServer((req, res) => {
    state.hits += 1;
    state.urls.push(req.url);
    handler(req, res, state.hits);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        state,
        close: () => new Promise((done) => { server.closeAllConnections?.(); server.close(done); }),
      });
    });
  });
}

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const silentLogger = { warn() {}, error() {}, log() {} };

module.exports = { startFakeServer, json, silentLogger };
