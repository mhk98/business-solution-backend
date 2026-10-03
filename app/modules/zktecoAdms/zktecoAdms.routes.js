const express = require("express");
const ZktecoAdmsService = require("./zktecoAdms.service");

// ZKTeco ADMS push protocol. Mounted at /iclock (outside /api/v1), before the
// global JSON/urlencoded parsers: devices post plain tab-separated text, often
// with a form content-type that would otherwise be parsed into an object.
const router = express.Router();

router.use(express.text({ type: () => true, limit: "5mb" }));

const getSerial = (req) => String(req.query.SN || req.query.sn || "").trim();
const getIp = (req) =>
  String(req.headers["x-forwarded-for"] || req.ip || "")
    .split(",")[0]
    .trim();

// Diagnostics: record every request except routine "OK" polls, so what a
// device actually sends can be read back from ZktecoAdmsTraces.
const db = require("../../../models");
const TRACE_KEEP_MS = 2 * 24 * 60 * 60 * 1000;
let traceCount = 0;
router.use((req, res, next) => {
  const send = res.send.bind(res);
  res.send = (payload) => {
    const response = typeof payload === "string" ? payload : String(payload ?? "");
    const routinePoll = req.path === "/getrequest" && response === "OK";
    if (!routinePoll && db.zktecoAdmsTrace) {
      const body = typeof req.body === "string" ? req.body : "";
      db.zktecoAdmsTrace
        .create({
          serialNumber: String(req.query.SN || req.query.sn || "").slice(0, 64) || null,
          method: req.method,
          path: req.path.slice(0, 255),
          query: JSON.stringify(req.query).slice(0, 2000),
          contentType: String(req.headers["content-type"] || "").slice(0, 128) || null,
          bodyLength: body.length,
          body: body.slice(0, 4000) || null,
          status: res.statusCode,
          response: response.slice(0, 1000),
          ipAddress: getIp(req).slice(0, 64) || null,
        })
        .then(() => {
          traceCount += 1;
          if (traceCount % 200 !== 0) return null;
          return db.zktecoAdmsTrace.destroy({
            where: {
              createdAt: { [db.Sequelize.Op.lt]: new Date(Date.now() - TRACE_KEEP_MS) },
            },
          });
        })
        .catch(() => {});
    }
    return send(payload);
  };
  next();
});


const sendText = (res, text) => res.type("text/plain").status(200).send(text);

const handle = (fn) => async (req, res) => {
  const serialNumber = getSerial(req);
  if (!serialNumber) return sendText(res, "OK");
  try {
    const text = await fn({
      serialNumber,
      ipAddress: getIp(req),
      table: req.query.table,
      tablename: req.query.tablename,
      query: req.query,
      body: typeof req.body === "string" ? req.body : "",
    });
    return sendText(res, text);
  } catch (error) {
    console.error("[zktecoAdms]", req.method, req.path, error.message);
    // Non-OK makes the device keep the data and retry later.
    return res.type("text/plain").status(500).send("ERROR");
  }
};

router.get("/cdata", handle(ZktecoAdmsService.handleHandshake));
router.post("/cdata", handle(ZktecoAdmsService.handleUpload));
// PUSH 3 ("acc" devices such as SenseFace 2A): registration + options.
router.post("/registry", handle(ZktecoAdmsService.handleRegistry));
router.all("/push", handle(ZktecoAdmsService.handlePushConfig));
router.get("/getrequest", handle(ZktecoAdmsService.handlePoll));
router.post("/querydata", handle(ZktecoAdmsService.handleQueryData));
router.post("/devicecmd", handle(ZktecoAdmsService.handleCommandResult));
router.get("/ping", handle(ZktecoAdmsService.handleHeartbeat));
// Anything else (other firmware endpoints) is answered OK and traced above.
router.all("*", (req, res) => sendText(res, "OK"));

module.exports = router;
