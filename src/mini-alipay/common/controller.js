"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// miniapp/src/controller.js
var controller_exports = {};
__export(controller_exports, {
  createPage: () => createPage
});
module.exports = __toCommonJS(controller_exports);

// miniapp/config.generated.json
var config_generated_default = { apiBaseUrl: "", buildId: "source-0.1.0", ALIPAY: { appId: "", appAlias: "alipay-main", approvedOfficePicker: "", officePickerEvidence: "" }, DOUYIN: { appId: "", appAlias: "douyin-main", approvedOfficePicker: "", officePickerEvidence: "" }, skillReleaseId: "4493fd06-28d7-4c57-b4af-27065515b68e" };

// miniapp/src/platform.js
var provider = "ALIPAY";
var host = provider === "ALIPAY" ? my : tt;
var options = config_generated_default[provider];
var apiBase = config_generated_default.apiBaseUrl;
var invoke = (name, params = {}) => new Promise((resolve, reject) => {
  if (typeof host[name] !== "function") return reject(new Error("\u5F53\u524D\u7248\u672C\u6682\u4E0D\u652F\u6301\u6B64\u64CD\u4F5C\uFF0C\u8BF7\u5347\u7EA7\u5BBF\u4E3B\u540E\u91CD\u8BD5\u3002"));
  host[name](__spreadProps(__spreadValues({}, params), { success: resolve, fail: () => reject(new Error("\u64CD\u4F5C\u672A\u5B8C\u6210\u3002\u53D6\u6D88\u3001\u6743\u9650\u6216\u7F51\u7EDC\u95EE\u9898\u53EF\u5728\u672C\u9875\u91CD\u65B0\u5C1D\u8BD5\u3002")) }));
});
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
}
function getStored(key) {
  try {
    return provider === "ALIPAY" ? host.getStorageSync({ key }).data : host.getStorageSync(key);
  } catch (e) {
    return null;
  }
}
function store(key, data) {
  if (provider === "ALIPAY") host.setStorageSync({ key, data });
  else host.setStorageSync(key, data);
}
function forget(key) {
  if (provider === "ALIPAY") host.removeStorageSync({ key });
  else host.removeStorageSync(key);
}
function environment() {
  var _a2, _b2, _c, _d;
  const s = host.getSystemInfoSync();
  return {
    provider,
    app_alias: options.appAlias,
    os: /ios/i.test((_a2 = s.platform) != null ? _a2 : s.system) ? "IOS" : "ANDROID",
    host_version: String((_c = (_b2 = s.version) != null ? _b2 : s.appVersion) != null ? _c : "unknown"),
    base_sdk: String((_d = s.SDKVersion) != null ? _d : "unknown"),
    build_id: config_generated_default.buildId
  };
}
async function loginCode() {
  if (provider === "ALIPAY") {
    const r2 = await invoke("getAuthCode", { scopes: ["auth_base"] });
    return r2.authCode;
  }
  const r = await invoke("login", { force: true });
  return r.code;
}
async function request(path, method, body, token2, key) {
  var _a2, _b2, _c, _d;
  if (!apiBase || !/^https:\/\//.test(apiBase)) throw new Error("\u670D\u52A1\u5730\u5740\u5C1A\u672A\u914D\u7F6E\uFF0C\u8BF7\u8054\u7CFB\u670D\u52A1\u63D0\u4F9B\u65B9\u3002");
  const header = __spreadValues(__spreadValues({ "Content-Type": "application/json" }, token2 ? { Authorization: "Bearer " + token2 } : {}), key ? { "Idempotency-Key": key } : {});
  const response = await invoke("request", { url: apiBase + path, method, data: body != null ? body : {}, [provider === "ALIPAY" ? "headers" : "header"]: header, timeout: 2e4, dataType: "json" });
  const status = (_a2 = response.status) != null ? _a2 : response.statusCode;
  let payload = response.data;
  if (typeof payload === "string") try {
    payload = JSON.parse(payload);
  } catch (e) {
    throw new Error("\u670D\u52A1\u54CD\u5E94\u4E0D\u53EF\u7528\u3002");
  }
  if (status < 200 || status >= 300) {
    const error = new Error((_c = (_b2 = payload == null ? void 0 : payload.error) == null ? void 0 : _b2.message) != null ? _c : "\u64CD\u4F5C\u5C1A\u672A\u5B8C\u6210\uFF0C\u8BF7\u5237\u65B0\u5F53\u524D\u72B6\u6001\u3002");
    error.code = (_d = payload == null ? void 0 : payload.error) == null ? void 0 : _d.code;
    error.requestId = payload == null ? void 0 : payload.request_id;
    throw error;
  }
  return payload.data;
}
async function confirm(title, content, confirmText = "\u7EE7\u7EED") {
  const r = provider === "ALIPAY" ? await invoke("confirm", { title, content, confirmButtonText: confirmText, cancelButtonText: "\u8FD4\u56DE" }) : await invoke("showModal", { title, content, confirmText, cancelText: "\u8FD4\u56DE" });
  return r.confirm === true;
}
function navigate(page, query = {}) {
  const q = Object.entries(query).filter(([, v]) => v !== null && v !== void 0).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(String(v))).join("&");
  return invoke(["MP01", "MP13", "MP14", "MP15"].includes(page) ? "reLaunch" : "navigateTo", { url: "/pages/" + page + "/index" + (q ? "?" + q : "") });
}
async function chooseImage() {
  var _a2, _b2;
  const r = await invoke("chooseImage", { count: 1, sizeType: ["original"], sourceType: ["album", "camera"] });
  return provider === "ALIPAY" ? { path: (_a2 = r.apFilePaths) == null ? void 0 : _a2[0], name: "\u8D44\u6599\u56FE\u7247.jpg" } : { path: (_b2 = r.tempFilePaths) == null ? void 0 : _b2[0], name: "\u8D44\u6599\u56FE\u7247.jpg" };
}
async function chooseOffice() {
  var _a2;
  if (!options.approvedOfficePicker || !options.officePickerEvidence) throw new Error("\u5F53\u524D\u73AF\u5883\u672A\u5F00\u653E\u529E\u516C\u6587\u4EF6\u9009\u62E9\uFF0C\u53EF\u5148\u7C98\u8D34\u6587\u5B57\u6216\u6DFB\u52A0\u8D44\u6599\u56FE\u7247\u3002");
  if (provider === "ALIPAY" && options.approvedOfficePicker === "chooseFileFromDisk") {
    const r = await invoke("chooseFileFromDisk", {});
    return { path: r.apFilePath, name: (_a2 = r.fileName) != null ? _a2 : "\u89C4\u8303\u6587\u4EF6" };
  }
  throw new Error("\u6B64\u6784\u5EFA\u672A\u63D0\u4F9B\u5DF2\u6838\u9A8C\u7684\u529E\u516C\u6587\u4EF6\u5165\u53E3\u3002");
}
async function fileBytes(path) {
  var _a2;
  const fs = (_a2 = host.getFileSystemManager) == null ? void 0 : _a2.call(host);
  if (!fs) throw new Error("\u5F53\u524D\u7248\u672C\u6682\u4E0D\u80FD\u8BFB\u53D6\u6587\u4EF6\u6458\u8981\uFF0C\u8BF7\u4F7F\u7528\u7C98\u8D34\u6587\u5B57\u5165\u53E3\u3002");
  return new Promise((resolve, reject) => fs.readFile({ filePath: path, success: (r) => resolve(new Uint8Array(r.data)), fail: () => reject(new Error("\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002")) }));
}
async function upload(path, grant) {
  var _a2;
  const r = await invoke("uploadFile", __spreadProps(__spreadValues({
    url: grant.limited_upload_target,
    filePath: path,
    [provider === "ALIPAY" ? "fileName" : "name"]: "file"
  }, provider === "ALIPAY" ? { fileType: "image" } : {}), {
    [provider === "ALIPAY" ? "headers" : "header"]: { Authorization: "Bearer " + grant.upload_token }
  }));
  const status = (_a2 = r.status) != null ? _a2 : r.statusCode;
  if (status !== 200) throw new Error("\u6587\u4EF6\u5C1A\u672A\u63A5\u6536\u5B8C\u6210\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u4E0A\u4F20\u3002");
  return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
}
async function pay(payload) {
  if (payload.query_required) return;
  if (provider === "ALIPAY") {
    await invoke("tradePay", { tradeNO: payload.tradeNO });
    return;
  }
  if (payload.mode !== "DOUYIN_GENERAL_TRADE") throw new Error("\u5F53\u524D\u5E73\u53F0\u6536\u94F6\u53C2\u6570\u4E0D\u53EF\u7528\u3002");
  const r = await invoke("requestOrder", { data: payload.data, byteAuthorization: payload.byteAuthorization });
  if (!r.orderId) throw new Error("\u5E73\u53F0\u672A\u8FD4\u56DE\u539F\u8BA2\u5355\u53F7\uFF0C\u8BF7\u67E5\u8BE2\u4ED8\u6B3E\u72B6\u6001\u3002");
  await invoke("getOrderPayment", { orderId: r.orderId });
}
async function fetchFile(url) {
  var _a2, _b2;
  const r = await invoke("downloadFile", { url });
  const status = (_a2 = r.status) != null ? _a2 : r.statusCode;
  if (status !== 200) throw new Error("\u9886\u53D6\u94FE\u63A5\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u9886\u53D6\u3002");
  return (_b2 = r.apFilePath) != null ? _b2 : r.tempFilePath;
}
async function openFile(path) {
  return invoke("openDocument", provider === "ALIPAY" ? { filePath: path, fileType: "xlsx" } : { filePath: path, showMenu: true });
}
function copyFileLink(url) {
  return provider === "ALIPAY" ? invoke("setClipboard", { text: url }) : invoke("setClipboardData", { data: url });
}

// miniapp/src/client.js
var state = { session: null, task: null, draftGoal: "", draftMode: "DISCOVER", proposal: null, confirmation: null, quote: null, order: null, run: null, resultSchema: null, resultVersion: null, selectedIssue: null, selectedTemplate: null, capability: null, consent: null, reworkSession: null, reworkForRun: null };
var _a, _b;
var token = (_b = (_a = getStored("p07-login")) == null ? void 0 : _a.token) != null ? _b : null;
var loginPromise = null;
async function authenticate() {
  if (token) return;
  if (!loginPromise) loginPromise = (async () => {
    const code = await loginCode(), key = uuid(), r = await request("/v1/p07/auth/platform-sessions", "POST", { provider, app_alias: options.appAlias, one_time_code: code }, null, key);
    token = r.session_token;
    store("p07-login", { token, expires: r.expires_at });
  })().finally(() => {
    loginPromise = null;
  });
  await loginPromise;
}
async function api(path, method = "GET", body, key, publicCall = false) {
  if (!publicCall) await authenticate();
  try {
    return await request("/v1/p07" + path, method, body, publicCall ? null : token, method === "GET" ? null : key != null ? key : uuid());
  } catch (error) {
    if (error.code === "AUTH_REQUIRED") {
      token = null;
      forget("p07-login");
    }
    throw error;
  }
}
function remember() {
  var _a2, _b2, _c, _d;
  store("p07-current", { session: (_a2 = state.session) == null ? void 0 : _a2.session_id, task: (_b2 = state.task) == null ? void 0 : _b2.task_id, run: (_c = state.run) == null ? void 0 : _c.run_id, order: (_d = state.order) == null ? void 0 : _d.order_id, purpose: state.correction ? "PLATFORM_CORRECTION" : null });
}
async function restore() {
  const ids = getStored("p07-current");
  if (!ids) return;
  state.correction = ids.purpose === "PLATFORM_CORRECTION";
  if (ids.session) state.session = await api("/agent-sessions/" + ids.session);
  if (ids.task) state.task = await api("/tasks/" + ids.task);
  if (ids.run) state.run = await api("/runs/" + ids.run);
  if (ids.order) state.order = await api("/orders/" + ids.order);
}
async function refreshTask() {
  if (state.task) state.task = await api("/tasks/" + state.task.task_id);
  return state.task;
}
async function readPlan() {
  await authenticate();
  return request("/transport/v1/tasks/" + state.task.task_id + "/plan", "GET", null, token);
}
async function orderContext(id) {
  await authenticate();
  return request("/transport/v1/orders/" + id + "/context", "GET", null, token);
}
async function resultSchema() {
  await authenticate();
  const r = await request("/transport/v1/runs/" + state.run.run_id + "/schema?result_version=" + state.run.result_version, "GET", null, token);
  state.resultSchema = r.schema;
  return r.schema;
}
async function prepareRework(id, key, clientRequestId, skillReleaseId) {
  await authenticate();
  return request("/transport/v1/runs/" + id + "/rework-sessions", "POST", { client_request_id: clientRequestId, skill_release_id: skillReleaseId }, token, key);
}
async function businessTransport(path, method = "GET", body, key) {
  await authenticate();
  return request("/transport/v1" + path, method, body, token, key);
}
function deletionReference() {
  var _a2, _b2;
  return (_b2 = (_a2 = getStored("p07-deletion")) == null ? void 0 : _a2.id) != null ? _b2 : null;
}
function rememberDeletion(job) {
  store("p07-deletion", { id: job.deletion_request_id });
}
function clearDraft() {
  state.session = null;
  state.task = null;
  state.draftGoal = "";
  state.draftMode = "DISCOVER";
  state.proposal = null;
  state.confirmation = null;
  state.quote = null;
  state.order = null;
  state.run = null;
  state.resultSchema = null;
  state.selectedIssue = null;
  state.selectedTemplate = null;
  state.reworkSession = null;
  state.reworkForRun = null;
  state.correction = false;
  state.consent = null;
  remember();
}

// miniapp/src/sha256.js
var K = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298];
var R = (x, n) => x >>> n | x << 32 - n;
function sha256(bytes) {
  const size = Math.ceil((bytes.length + 9) / 64) * 64, b = new Uint8Array(size);
  b.set(bytes);
  b[bytes.length] = 128;
  const dv = new DataView(b.buffer), bits = bytes.length * 8;
  dv.setUint32(size - 8, Math.floor(bits / 4294967296));
  dv.setUint32(size - 4, bits >>> 0);
  const h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225], w = new Uint32Array(64);
  for (let o = 0; o < size; o += 64) {
    for (let j2 = 0; j2 < 16; j2++) w[j2] = dv.getUint32(o + j2 * 4);
    for (let j2 = 16; j2 < 64; j2++) w[j2] = w[j2 - 16] + (R(w[j2 - 15], 7) ^ R(w[j2 - 15], 18) ^ w[j2 - 15] >>> 3) + w[j2 - 7] + (R(w[j2 - 2], 17) ^ R(w[j2 - 2], 19) ^ w[j2 - 2] >>> 10) >>> 0;
    let [a, c, d, e, f, g, i, j] = h;
    for (let t = 0; t < 64; t++) {
      const p = j + (R(f, 6) ^ R(f, 11) ^ R(f, 25)) + (f & g ^ ~f & i) + K[t] + w[t] >>> 0, q = (R(a, 2) ^ R(a, 13) ^ R(a, 22)) + (a & c ^ a & d ^ c & d) >>> 0;
      j = i;
      i = g;
      g = f;
      f = e + p >>> 0;
      e = d;
      d = c;
      c = a;
      a = p + q >>> 0;
    }
    [a, c, d, e, f, g, i, j].forEach((v, n) => h[n] = h[n] + v >>> 0);
  }
  return h.map((n) => n.toString(16).padStart(8, "0")).join("");
}

// miniapp/src/pages.generated.js
var titles = { "MP01": "\u6574\u7406\u9996\u9875", "MP02": "\u8D44\u6599\u6E05\u5355", "MP03": "\u89C4\u8303\u8F93\u5165", "MP04": "\u9884\u68C0\u4E0E\u62A5\u4EF7", "MP05": "\u5904\u7406\u8FDB\u5EA6", "MP06": "\u63A8\u8350\u89C4\u8303", "MP07": "\u5B57\u6BB5\u7F16\u8F91", "MP08": "\u7ED3\u679C\u6982\u89C8", "MP09": "\u95EE\u9898\u5217\u8868", "MP10": "\u8BB0\u5F55\u95EE\u9898\u8BE6\u60C5", "MP11": "\u6765\u6E90\u4F9D\u636E", "MP12": "\u7ED3\u679C\u9886\u53D6", "MP13": "\u4EFB\u52A1\u5217\u8868", "MP14": "\u6211\u7684\u89C4\u8303", "MP15": "\u6211\u7684", "MP16": "\u8BA2\u5355\u8BE6\u60C5", "MP17": "\u9690\u79C1\u4E0E\u6570\u636E\u7BA1\u7406", "MP18": "\u5E2E\u52A9\u4E0E\u552E\u540E" };

// miniapp/src/schema-editor.js
var fieldTypes = [
  { value: "TEXT", label: "\u6587\u672C" },
  { value: "DECIMAL", label: "\u7CBE\u786E\u5C0F\u6570" },
  { value: "INTEGER", label: "\u6574\u6570" },
  { value: "BOOLEAN", label: "\u662F\u6216\u5426" },
  { value: "DATE", label: "\u65E5\u671F" },
  { value: "DATETIME", label: "\u542B\u65F6\u533A\u65F6\u95F4" },
  { value: "ENUM", label: "\u679A\u4E3E\u9009\u9879" }
];
var comparators = [
  { value: "EQ", label: "\u7B49\u4E8E" },
  { value: "NE", label: "\u4E0D\u7B49\u4E8E" },
  { value: "GT", label: "\u5927\u4E8E" },
  { value: "GE", label: "\u5927\u4E8E\u7B49\u4E8E" },
  { value: "LT", label: "\u5C0F\u4E8E" },
  { value: "LE", label: "\u5C0F\u4E8E\u7B49\u4E8E" }
];
var clone = (value) => JSON.parse(JSON.stringify(value));
function describeRule(rule, fields) {
  var _a2, _b2, _c, _d, _e;
  const label = (id) => {
    var _a3, _b3;
    return (_b3 = (_a3 = fields.find((f) => f.field_id === id)) == null ? void 0 : _a3.label) != null ? _b3 : id;
  };
  if (rule.op === "FIELD") return label(rule.field_id);
  if (rule.op === "CONST") return String(rule.value);
  if (rule.op === "COMPARE") return ((_a2 = rule.args) != null ? _a2 : []).map((x) => describeRule(x, fields)).join(" " + ((_c = (_b2 = comparators.find((c) => c.value === rule.comparator)) == null ? void 0 : _b2.label) != null ? _c : "\u6BD4\u8F83") + " ");
  if (rule.op === "REQUIRED_IF") return "\u5F53 " + describeRule(rule.args[0], fields) + " \u65F6\uFF0C" + label(rule.field_id) + " \u5FC5\u586B";
  const names = { AND: " \u5E76\u4E14 ", OR: " \u6216\u8005 ", DECIMAL_ADD: " + ", DECIMAL_SUBTRACT: " \u2212 ", DECIMAL_MULTIPLY: " \xD7 ", DECIMAL_DIVIDE: " \xF7 " };
  return "(" + ((_d = rule.args) != null ? _d : []).map((x) => describeRule(x, fields)).join((_e = names[rule.op]) != null ? _e : "\u3001") + ")";
}
function editorView(schema) {
  return { draft: schema, fields: schema.fields.map((f) => {
    var _a2, _b2;
    return __spreadProps(__spreadValues({}, f), {
      typeLabel: (_a2 = fieldTypes.find((t) => t.value === f.type)) == null ? void 0 : _a2.label,
      enumText: ((_b2 = f.enum_values) != null ? _b2 : []).join("\n")
    });
  }), ruleViews: schema.rules.map((r, index) => ({ index, label: describeRule(r, schema.fields) })) };
}
function schemaPatch(original, draft) {
  const patches = [];
  for (const field of original.fields) if (!draft.fields.some((f) => f.field_id === field.field_id)) patches.push({ op: "REMOVE_FIELD", field_id: field.field_id });
  for (const field of draft.fields) {
    const old = original.fields.find((f) => f.field_id === field.field_id);
    if (!old) patches.push({ op: "ADD_FIELD", field });
    else if (JSON.stringify(old) !== JSON.stringify(field)) patches.push({ op: "UPDATE_FIELD", field_id: field.field_id, field });
  }
  if (original.row_kind !== draft.row_kind) patches.push({ op: "SET_ROW_KIND", row_kind: draft.row_kind });
  if (JSON.stringify(original.rules) !== JSON.stringify(draft.rules)) patches.push({ op: "SET_RULES", rules: draft.rules });
  return patches;
}
function ruleFromForm(schema, form) {
  const field = schema.fields.find((f) => f.field_id === form.ruleField);
  if (!field) throw new Error("\u8BF7\u9009\u62E9\u6761\u4EF6\u5B57\u6BB5\u3002");
  let value = form.ruleValue;
  if (value === "") throw new Error("\u8BF7\u586B\u5199\u7528\u4E8E\u6BD4\u8F83\u7684\u503C\u3002");
  if (field.type === "INTEGER") {
    if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("\u6BD4\u8F83\u503C\u5FC5\u987B\u662F\u5B89\u5168\u6574\u6570\u3002");
    value = Number(value);
  }
  if (field.type === "BOOLEAN") {
    if (!["true", "false"].includes(value)) throw new Error("\u662F\u6216\u5426\u7684\u6BD4\u8F83\u503C\u586B\u5199 true \u6216 false\u3002");
    value = value === "true";
  }
  const condition = { op: "COMPARE", comparator: form.ruleComparator, args: [{ op: "FIELD", field_id: field.field_id }, { op: "CONST", value }] };
  if (form.ruleKind === "REQUIRED_IF") {
    if (!schema.fields.some((f) => f.field_id === form.ruleTarget)) throw new Error("\u8BF7\u9009\u62E9\u9700\u8981\u5FC5\u586B\u7684\u5B57\u6BB5\u3002");
    return { op: "REQUIRED_IF", field_id: form.ruleTarget, args: [condition] };
  }
  return condition;
}

// miniapp/src/presentation.js
var types = { TEXT: "\u6587\u672C", INTEGER: "\u6574\u6570", DECIMAL: "\u91D1\u989D / \u6570\u503C", DATE: "\u65E5\u671F", DATETIME: "\u65E5\u671F\u65F6\u95F4", BOOLEAN: "\u662F / \u5426", ENUM: "\u9009\u9879" };
function fileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "\u5927\u5C0F\u5F85\u6838\u5BF9";
  return bytes < 1e3 ? bytes + " B" : bytes < 1e6 ? (bytes / 1e3).toFixed(bytes < 1e4 ? 1 : 0) + " KB" : (bytes / 1e6).toFixed(1) + " MB";
}
function sourceView(source) {
  const name = source.name || "\u6587\u5B57\u8D44\u6599", icon = /\.pdf$/i.test(name) ? "pdf" : /\.(png|jpe?g|webp)$/i.test(name) ? "image" : /\.(xlsx?|csv)$/i.test(name) ? "sheet" : "document";
  return __spreadProps(__spreadValues({}, source), { icon, meta: fileSize(source.bytes) + " \xB7 " + (source.status === "PURGED" ? "\u539F\u4EF6\u5DF2\u6E05\u7406" : "\u5DF2\u63A5\u6536") });
}
function fieldView(field) {
  return __spreadProps(__spreadValues({}, field), {
    icon: ["DATE", "DATETIME"].includes(field.type) ? "calendar" : ["INTEGER", "DECIMAL"].includes(field.type) ? "currency" : "text",
    meta: (types[field.type] || field.type) + " \xB7 " + (field.required ? "\u5FC5\u586B" : "\u9009\u586B"),
    reason: field.description || "\u6309\u5F53\u524D\u89C4\u8303\u6574\u7406"
  });
}
function fieldExamples(fields) {
  const selected = [], seen = /* @__PURE__ */ new Set();
  for (const field of fields) {
    if (!seen.has(field.type)) {
      selected.push(field);
      seen.add(field.type);
    }
    if (selected.length === 3) break;
  }
  for (const field of fields) {
    if (selected.length === 3) break;
    if (!selected.includes(field)) selected.push(field);
  }
  return selected.map(fieldView);
}
function tableView(records, schema) {
  const fields = ((schema == null ? void 0 : schema.fields) || []).slice(0, 4);
  return {
    previewColumns: fields.map((f) => ({ id: f.field_id, label: f.label })),
    previewRows: records.slice(0, 5).map((r) => ({ id: r.record_id, cells: fields.map((f) => {
      const cell = r.fields.find((v) => v.field_id === f.field_id);
      return { id: f.field_id, value: (cell == null ? void 0 : cell.typed_value) == null ? "\u5F85\u8865" : String(cell.typed_value), unresolved: (cell == null ? void 0 : cell.typed_value) == null };
    }) }))
  };
}
function issueView(issue, record, schema) {
  const field = schema == null ? void 0 : schema.fields.find((f) => f.field_id === issue.field_id), cells = (record == null ? void 0 : record.fields) || [];
  const label = (f) => {
    var _a2;
    return ((_a2 = schema == null ? void 0 : schema.fields.find((x) => x.field_id === f.field_id)) == null ? void 0 : _a2.label) || f.field_id;
  };
  const identified = cells.filter((f) => {
    var _a2;
    return f.typed_value != null && ((_a2 = schema == null ? void 0 : schema.identity_keys) == null ? void 0 : _a2.includes(f.field_id));
  });
  const other = cells.filter((f) => {
    var _a2;
    return f.typed_value != null && !((_a2 = schema == null ? void 0 : schema.identity_keys) == null ? void 0 : _a2.includes(f.field_id)) && f.field_id !== issue.field_id;
  }).sort((a, b) => {
    var _a2, _b2;
    return Number(((_a2 = schema == null ? void 0 : schema.fields.find((f) => f.field_id === b.field_id)) == null ? void 0 : _a2.type) === "INTEGER") - Number(((_b2 = schema == null ? void 0 : schema.fields.find((f) => f.field_id === a.field_id)) == null ? void 0 : _b2.type) === "INTEGER");
  });
  const issueCell = cells.find((f) => f.field_id === issue.field_id);
  const facts = [issueCell || { field_id: issue.field_id, typed_value: null }, ...other].slice(0, 3).map((f) => {
    var _a2;
    return { id: f.field_id, label: label(f), value: f.typed_value == null ? "\u5F85\u8865" : String(f.typed_value) + (((_a2 = schema == null ? void 0 : schema.fields.find((x) => x.field_id === f.field_id)) == null ? void 0 : _a2.unit) ? " " + schema.fields.find((x) => x.field_id === f.field_id).unit : ""), unresolved: f.field_id === issue.field_id };
  });
  return {
    issueLabel: (field == null ? void 0 : field.label) || issue.field_id,
    issueRecordTitle: identified[0] ? String(identified[0].typed_value) : "\u8BB0\u5F55 " + (record ? record.ordinal + 1 : issue.record_id),
    issueRecordSubtitle: identified.slice(1).map((f) => String(f.typed_value)).join(" \xB7 ") || (schema == null ? void 0 : schema.row_kind) || "\u5F85\u786E\u8BA4\u7684\u539F\u8BB0\u5F55",
    issueFacts: facts,
    issueRecordAvailable: !!record
  };
}

// assets/brand/current.json
var current_default = {
  protocol: "P07-BRAND-IDENTITY-1",
  release_id: "P07-BRAND-CIYUANSHIXU-1.0.0",
  version: "1.0.0",
  approved_at: "2026-11-01",
  status: "USER_APPROVED",
  name_zh: "\u8BCD\u5143\u62FE\u5E8F",
  project_alias_en: "Table Purifier",
  previous_name_zh: "\u8868\u683C\u4FEE\u590D\u7AD9",
  tagline_zh: "\u628A\u96F6\u6563\u8D44\u6599\uFF0C\u6574\u7406\u6210\u6709\u636E\u53EF\u67E5\u7684\u8868\u683C",
  short_description_zh: "AI \u8D44\u6599\u6574\u7406\u4E0E\u89C4\u8303\u6210\u8868\u5DE5\u5177",
  selection: {
    authority: "USER_MESSAGE",
    instruction: "\u5B9A\u7A3F\u4E3A \u8BCD\u5143\u62FE\u5E8F\uFF1BLOGO\u4F7F\u752806",
    concept_id: "06",
    slug: "06-folded-paper",
    name_zh: "\u6298\u7EB8\u5F52\u6863",
    name_en: "Folded Paper",
    source: "assets/brand/logo-exploration/2026-11-01/originals/06-folded-paper.png",
    source_sha256: "bb4f0cc9e23200d060753468f75fe8676e7656f0aa4d93d5fd16a86220f2b830"
  },
  asset_directory: "assets/brand/ciyuan-shixu/v1.0.0",
  palette: {
    logo_jade: "#167864",
    logo_orange: "#EB9B4A",
    logo_paper: "#FADEB7",
    text: "#203C32",
    background: "#EAF1EE",
    surface: "#FFFFFF",
    ui_primary: "#17745E"
  },
  rules: {
    clear_space: "At least 1/8 of the visible mark height on each side; supplied icon canvases use 78% visible height.",
    minimum_color_mark_px: 32,
    preferred_color_mark_px: 64,
    small_16_24_px: "Favicon-only silhouette; internal detail is not guaranteed readable.",
    vector_master: "NOT_CREATED",
    english_brand_name: "NOT_SEPARATELY_APPROVED",
    frozen_b_design: "PRESERVED_UNCHANGED",
    ui_theme: "B1.0.0 with the approved brand name/logo overlay"
  },
  scope: {
    local_source_branding: true,
    repository_and_workspace_renamed: false,
    application_deployment: false,
    new_image_generation: false,
    live_platform_acceptance: "NOT_RUN"
  }
};

// miniapp/src/brand.js
var brand = {
  name: current_default.name_zh,
  description: current_default.short_description_zh,
  tagline: current_default.tagline_zh,
  releaseId: current_default.release_id,
  logo: "/assets/brand/logo.png"
};

// miniapp/src/controller.js
var STATUS = { INITIALIZING: "\u6B63\u5728\u51C6\u5907\u6574\u7406\u4F1A\u8BDD", READY_FOR_INPUT: "\u4F1A\u8BDD\u5DF2\u5C31\u7EEA\uFF0C\u53EF\u4EE5\u63D0\u4EA4\u8D44\u6599", INPUT_RECEIVED: "\u8D44\u6599\u5DF2\u63A5\u6536\uFF0C\u7B49\u5F85\u5206\u6790", ANALYZING: "\u6B63\u5728\u7406\u89E3\u5168\u90E8\u5DF2\u63D0\u4EA4\u8D44\u6599", WAITING_CONFIRMATION: "\u89C4\u8303\u8349\u6848\u5DF2\u51C6\u5907\u597D\uFF0C\u8BF7\u786E\u8BA4", QUOTABLE: "\u65B9\u6848\u5DF2\u786E\u8BA4\uFF0C\u53EF\u4EE5\u9884\u4F30\u8D39\u7528", AWAITING_PAYMENT: "\u7B49\u5F85\u539F\u5E73\u53F0\u786E\u8BA4\u4ED8\u6B3E", BATCH_QUEUED: "\u5DF2\u6838\u5B9E\u4ED8\u6B3E\uFF0C\u7B49\u5F85\u6574\u7406", BATCH_RUNNING: "\u6B63\u5728\u6279\u91CF\u6574\u7406", PERSISTING_RESULTS: "\u6B63\u5728\u4FDD\u5B58\u5E76\u6838\u9A8C\u7ED3\u679C", RELEASING_RUNTIME: "\u7ED3\u679C\u4E0E\u4EFB\u52A1\u73AF\u5883\u5206\u522B\u5904\u7406\uFF0C\u6B63\u5728\u6E05\u7406\u73AF\u5883", CLOSED: "\u4EFB\u52A1\u73AF\u5883\u5DF2\u6E05\u7406\uFF0C\u7ED3\u679C\u7EE7\u7EED\u4FDD\u7559", FAILED: "\u6574\u7406\u672A\u5B8C\u6210\uFF0C\u8BF7\u67E5\u770B\u8BA2\u5355\u4E0E\u552E\u540E", CANCELED: "\u6574\u7406\u5DF2\u505C\u6B62", INITIALIZATION_FAILED: "\u4F1A\u8BDD\u51C6\u5907\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5" };
var labels = { CONFIRMED: "\u670D\u52A1\u7AEF\u5DF2\u6838\u5B9E\u4ED8\u6B3E", PENDING: "\u7B49\u5F85\u4ED8\u6B3E\u786E\u8BA4", UNKNOWN: "\u72B6\u6001\u5F85\u6838\u5BF9", NOT_CREATED: "\u5C1A\u672A\u53D1\u8D77\u652F\u4ED8", DELIVERABLE: "\u7ED3\u679C\u53EF\u9886\u53D6", DELIVERED: "\u5DF2\u786E\u8BA4\u53D6\u7528", NONE: "\u65E0\u9000\u6B3E\u7533\u8BF7", SUCCEEDED: "\u5DF2\u5B8C\u6210", PROCESSING: "\u5904\u7406\u4E2D", REQUESTED: "\u5DF2\u7533\u8BF7", PARTIAL: "\u90E8\u5206\u9000\u6B3E", FULL: "\u5168\u989D\u9000\u6B3E", NOT_STARTED: "\u5C1A\u672A\u751F\u4EA7", IN_PROGRESS: "\u6B63\u5728\u5C65\u7EA6" };
var writable = () => state.session && ["READY_FOR_INPUT", "INPUT_RECEIVED", "WAITING_CONFIRMATION", "QUOTABLE"].includes(state.session.status);
function values(record, schema) {
  return record.fields.map((f) => {
    var _a2, _b2;
    return { id: f.field_id, label: (_b2 = (_a2 = schema == null ? void 0 : schema.fields.find((x) => x.field_id === f.field_id)) == null ? void 0 : _a2.label) != null ? _b2 : f.field_id, value: f.typed_value === null ? "\u2014" : String(f.typed_value), status: f.status, evidence: f.evidence_ids };
  });
}
function recordView(record, schema) {
  const fields = values(record, schema);
  return __spreadProps(__spreadValues({}, record), { values: fields, keyValues: fields.slice(0, 5), moreFields: fields.length > 5 });
}
function createPage(page) {
  return {
    data: {
      page,
      brand,
      title: titles[page],
      loading: false,
      error: "",
      notice: "",
      phase: "",
      ready: false,
      mode: "DISCOVER",
      goal: "",
      text: "",
      instruction: "",
      name: "",
      value: "",
      note: "",
      category: "\u8D44\u6599\u6574\u7406\u95EE\u9898",
      supportAccess: false,
      sources: [],
      homeSources: [],
      sourceCount: 0,
      fields: [],
      fieldCards: [],
      previewColumns: [],
      previewRows: [],
      records: [],
      issues: [],
      files: [],
      tasks: [],
      templates: [],
      orders: [],
      nextCursor: null,
      selectedAction: "",
      selectedEvidence: "",
      filter: "",
      policy: null,
      quote: null,
      order: null,
      run: null,
      task: null,
      session: null,
      plan: null,
      proposal: null,
      evidence: null,
      decisionPreview: null,
      deletion: null,
      capability: null,
      counts: null,
      bindingId: null,
      contractId: null,
      consentId: null,
      primaryFiles: [],
      additionalFiles: [],
      moreFiles: false,
      expandedRecord: "",
      environment: environment(),
      canChooseOffice: !!config_generated_default[provider].approvedOfficePicker,
      draft: null,
      ruleViews: [],
      fieldTypes,
      comparators,
      ruleKind: "COMPARE",
      ruleField: "",
      ruleTarget: "",
      ruleComparator: "GE",
      ruleValue: "",
      templateEdit: false,
      reworkReady: false
    },
    onLoad(query = {}) {
      this.route = query;
      this.pendingKeys = {};
      this.visible = true;
      this.localFile = null;
    },
    onShow() {
      this.visible = true;
      this.perform(async () => {
        if (!state.session && page !== "MP17" && page !== "MP18") await restore();
        await this.refresh();
      });
    },
    onHide() {
      this.visible = false;
      clearTimeout(this.poller);
    },
    onUnload() {
      this.visible = false;
      clearTimeout(this.poller);
      this.localFile = null;
    },
    async perform(fn) {
      var _a2;
      if (this.data.loading) return;
      this.setData({ loading: true, error: "" });
      try {
        await fn();
      } catch (e) {
        this.setData(__spreadValues({ error: (_a2 = e.message) != null ? _a2 : "\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5\u3002" }, e.requestId ? { notice: "\u8BF7\u6C42\u7F16\u53F7\uFF1A" + e.requestId } : {}));
      } finally {
        this.setData({ loading: false });
      }
    },
    key(action) {
      var _a2;
      return (_a2 = this.pendingKeys[action]) != null ? _a2 : this.pendingKeys[action] = uuid();
    },
    done(action) {
      delete this.pendingKeys[action];
    },
    async write(action, path, body) {
      const r = await api(path, "POST", body, this.key(action));
      this.done(action);
      return r;
    },
    onInput(e) {
      const field = e.currentTarget.dataset.field;
      if (field === "goal" && writable() && !state.task) state.draftGoal = e.detail.value;
      this.setData({ [field]: e.detail.value });
    },
    onChoice(e) {
      var _a2;
      if (page === "MP10" && !this.data.reworkReady) return;
      this.setData({ selectedAction: e.currentTarget.dataset.action, selectedEvidence: (_a2 = e.currentTarget.dataset.id) != null ? _a2 : "", decisionPreview: null });
    },
    onMode(e) {
      if (state.task) return;
      this.setData({ mode: e.currentTarget.dataset.mode });
    },
    loadEditor(schema, key) {
      var _a2, _b2;
      if (this.editorKey === key) {
        this.setData(editorView(clone(this.data.draft)));
        return;
      }
      this.editorKey = key;
      this.setData({ expandedField: (_b2 = (_a2 = schema.fields[0]) == null ? void 0 : _a2.field_id) != null ? _b2 : "" });
      this.originalSchema = clone(schema);
      this.setData(editorView(clone(schema)));
    },
    onSchemaInput(e) {
      const { id, property } = e.currentTarget.dataset, draft = clone(this.data.draft), field = draft.fields.find((f) => f.field_id === id), value = e.detail.value;
      if (field) {
        if (property === "enum_values") field.enum_values = value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
        else if (property === "scale") {
          if (value !== "" && (!/^\d+$/.test(value) || Number(value) > 18)) {
            this.setData({ error: "\u5C0F\u6570\u4F4D\u6570\u8BF7\u586B\u5199 0 \u81F3 18\u3002" });
            return;
          }
          field.scale = value === "" ? null : Number(value);
        } else field[property] = property === "unit" && value === "" ? null : value;
      } else draft[property] = value;
      this.setData(editorView(draft));
    },
    async ensureTask() {
      var _a2;
      if (!writable()) throw new Error("\u8BF7\u5148\u65B0\u5EFA\u4F1A\u8BDD\uFF0C\u5E76\u7B49\u5F85\u51C6\u5907\u5B8C\u6210\u3002");
      if (!state.task) {
        const goal = (_a2 = state.draftGoal) != null ? _a2 : this.data.goal;
        state.task = await this.write("create-task", "/tasks", __spreadValues({ mode: this.data.mode, client_request_id: this.key("task-request"), agent_session_id: state.session.session_id }, goal ? { optional_goal: goal } : {}));
        state.draftGoal = "";
        remember();
      }
      return refreshTask();
    },
    async refresh() {
      var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t;
      if (this.route.template && page === "MP07") {
        const t = await api("/private-templates/" + this.route.template);
        state.selectedTemplate = t;
        this.setData({ templateEdit: true, name: t.name });
        this.loadEditor(t.schema, "private:" + t.template_id + ":" + t.version);
        return;
      }
      if (this.route.task && ((_a2 = state.task) == null ? void 0 : _a2.task_id) !== this.route.task) {
        state.task = await api("/tasks/" + this.route.task);
        state.session = await api("/agent-sessions/" + state.task.agent_session_id);
        state.run = null;
        state.quote = null;
        state.confirmation = null;
        state.proposal = null;
        state.order = null;
      }
      if (this.route.run && ((_b2 = state.run) == null ? void 0 : _b2.run_id) !== this.route.run) state.run = await api("/runs/" + this.route.run);
      if (this.route.order) {
        state.order = await api("/orders/" + this.route.order);
        const c = await orderContext(state.order.order_id);
        if (((_c = state.task) == null ? void 0 : _c.task_id) !== c.task_id) {
          state.task = await api("/tasks/" + c.task_id);
          state.session = await api("/agent-sessions/" + c.session_id);
          state.run = c.run_id ? await api("/runs/" + c.run_id) : null;
          state.quote = null;
          state.confirmation = null;
          state.proposal = null;
        }
      }
      if (state.session) state.session = await api("/agent-sessions/" + state.session.session_id);
      if (state.task) await refreshTask();
      if (state.correction && !state.task) this.setData({ mode: "PROVIDED", notice: "\u8FD9\u662F\u539F\u5355\u7EA0\u9519\u7684\u65B0\u4F1A\u8BDD\u3002\u8BF7\u91CD\u4F20\u9700\u8981\u6838\u5BF9\u7684\u539F\u59CB\u8D44\u6599\uFF0C\u5206\u6790\u786E\u8BA4\u540E\u518D\u63D0\u4EA4\u9650\u65F6\u552E\u540E\u5BA1\u6838\uFF1B\u5BA1\u6838\u901A\u8FC7\u524D\u4E0D\u6536\u53D6\u7B2C\u4E8C\u6B21\u8D39\u7528\u3002" });
      const env = environment();
      if (!state.capability) state.capability = await api("/capabilities?" + Object.entries(env).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&"), "GET", null, null, true);
      const sources = ((_e = (_d = state.task) == null ? void 0 : _d.sources) != null ? _e : []).map(sourceView), homeSources = sources.filter((s) => s.role !== "TEMPLATE");
      this.setData({
        session: state.session,
        task: state.task,
        sources,
        homeSources: homeSources.slice(0, 3),
        sourceCount: homeSources.length,
        goal: (_h = (_g = (_f = state.task) == null ? void 0 : _f.goal) != null ? _g : state.draftGoal) != null ? _h : "",
        ready: !!writable(),
        mode: (_k = (_j = (_i = state.task) == null ? void 0 : _i.mode) != null ? _j : state.draftMode) != null ? _k : this.data.mode,
        phase: (_m = STATUS[(_l = state.session) == null ? void 0 : _l.status]) != null ? _m : "\u5148\u65B0\u5EFA\u4F1A\u8BDD\uFF0C\u51C6\u5907\u597D\u540E\u518D\u6DFB\u52A0\u8D44\u6599\u3002",
        capability: state.capability
      });
      if (["MP03", "MP06", "MP07"].includes(page) && state.task) {
        if (page === "MP03" && state.selectedTemplate) this.setData({ fields: state.selectedTemplate.schema.fields, name: state.selectedTemplate.name });
        else if (((_n = state.session) == null ? void 0 : _n.status) === "WAITING_CONFIRMATION" || ((_o = state.session) == null ? void 0 : _o.status) === "QUOTABLE") {
          state.proposal = await api("/tasks/" + state.task.task_id + "/schema-proposal");
          this.setData(__spreadProps(__spreadValues({
            proposal: state.proposal,
            fields: state.proposal.schema.fields,
            fieldCards: fieldExamples(state.proposal.schema.fields)
          }, tableView(state.proposal.preview_records, state.proposal.schema)), {
            records: state.proposal.preview_records.map((r) => __spreadProps(__spreadValues({}, r), { values: values(r, state.proposal.schema) }))
          }));
        }
        if (page === "MP07" && state.proposal) this.loadEditor(state.proposal.schema, "proposal:" + state.proposal.proposal_id + ":" + state.proposal.version);
      }
      if (page === "MP04" && state.task) {
        const p = await readPlan();
        this.setData({ plan: p.plan, bindingId: p.binding_id, contractId: p.contract_id });
        const correction = await businessTransport("/tasks/" + state.task.task_id + "/correction");
        state.correction = correction.is_correction;
        this.setData({ correction });
        if (p.contract_id) state.confirmation = { contract_id: p.contract_id, contract_hash: p.contract_hash, confirmed_plan: p.plan };
        if (p.order_id) state.order = await api("/orders/" + p.order_id);
        this.setData({ quote: state.quote, order: state.order });
      }
      if (((_p = state.task) == null ? void 0 : _p.current_run_id) && !state.run) state.run = await api("/runs/" + state.task.current_run_id);
      if (state.run && ["MP05", "MP08", "MP09", "MP10", "MP12"].includes(page)) {
        state.run = await api("/runs/" + state.run.run_id);
        this.setData({ run: state.run, stageLabel: state.run.stage === "AGENT_BATCH" ? "\u6574\u7406\u4E0E\u6821\u9A8C" : state.run.execution_status === "SUCCEEDED" ? "\u7ED3\u679C\u5DF2\u4FDD\u5B58" : "\u7B49\u5F85\u5904\u7406" });
        if (state.run.result_version && (!state.resultSchema || this.schemaRun !== state.run.run_id)) {
          await resultSchema();
          this.schemaRun = state.run.run_id;
        }
        if (page === "MP08" && state.run.result_version) {
          const r = await api(`/runs/${state.run.run_id}/records?result_version=${state.run.result_version}&limit=20`);
          this.setData({ records: r.records.map((x) => recordView(x, state.resultSchema)), counts: r.counts, nextCursor: r.next_cursor });
        }
        if (page === "MP09" && state.run.result_version) {
          const r = await api(`/runs/${state.run.run_id}/issues?result_version=${state.run.result_version}&limit=20${this.data.filter ? "&severity=" + this.data.filter : ""}`);
          this.setData({ issues: r.issues, nextCursor: r.next_cursor, affected: r.affected_records });
        }
        if (page === "MP10") {
          const issue = state.selectedIssue;
          if (!issue) throw new Error("\u8BF7\u4ECE\u95EE\u9898\u5217\u8868\u9009\u62E9\u4E00\u9879\u3002");
          this.setData({ issue, canUserValue: issue.allowed_decisions.includes("USER_VALUE"), canEvidence: issue.allowed_decisions.includes("CHOOSE_EVIDENCE"), canKeep: issue.allowed_decisions.includes("KEEP_UNRESOLVED") });
          if (this.issueKey !== issue.issue_id) {
            this.issueKey = issue.issue_id;
            this.setData({ selectedAction: "", selectedEvidence: "", decisionPreview: null });
            let record = null, cursor = null;
            for (let batch = 0; batch < 50; batch++) {
              const r = await api(`/runs/${state.run.run_id}/records?result_version=${state.run.result_version}&limit=20${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`);
              record = r.records.find((r2) => r2.record_id === issue.record_id);
              if (record || !r.next_cursor) break;
              cursor = r.next_cursor;
            }
            this.setData(issueView(issue, record, state.resultSchema));
          }
          if (!state.reworkSession || state.reworkForRun !== state.run.run_id) {
            const prepared = await prepareRework(state.run.run_id, this.key("rework-session"), this.key("rework-request"), config_generated_default.skillReleaseId);
            state.reworkSession = { session_id: prepared.session_id };
            state.reworkForRun = state.run.run_id;
            this.done("rework-session");
          }
          state.reworkSession = await api("/agent-sessions/" + state.reworkSession.session_id);
          this.setData({ reworkReady: state.reworkSession.status === "READY_FOR_INPUT", reworkPhase: STATUS[state.reworkSession.status] });
          const excerpts = [];
          for (const id of issue.evidence_ids.slice(0, 8)) excerpts.push(await api("/evidence/" + id));
          this.setData({ excerpts });
        }
        if (page === "MP12" && state.run.result_version) {
          const r = await api("/runs/" + state.run.run_id + "/artifacts"), names = ["result.xlsx", "standard.xlsx", "issues.xlsx"];
          this.setData({ files: r.artifacts, primaryFiles: names.map((name) => r.artifacts.find((f) => f.name === name)).filter(Boolean), additionalFiles: r.artifacts.filter((f) => !names.includes(f.name)), resultVersion: r.result_version });
        }
      }
      if (page === "MP11") {
        const id = this.route.evidence;
        if (!id) throw new Error("\u8BF7\u9009\u62E9\u9700\u8981\u67E5\u770B\u7684\u6765\u6E90\u6458\u5F55\u3002");
        this.setData({ evidence: await api("/evidence/" + id) });
      }
      if (page === "MP13") {
        const r = await api("/tasks?limit=20");
        this.setData({ tasks: r.items, nextCursor: r.next_cursor });
      }
      if (page === "MP14") {
        const r = await api("/private-templates?limit=20" + (this.data.name ? "&query=" + encodeURIComponent(this.data.name) : ""));
        this.setData({ templates: r.items, nextCursor: r.next_cursor });
      }
      if (page === "MP15") {
        const r = await api("/orders?limit=20");
        this.setData({ orders: r.items, nextCursor: r.next_cursor });
      }
      if (page === "MP16" && state.order) {
        state.order = await api("/orders/" + state.order.order_id);
        this.setData({ order: state.order, paymentLabel: labels[state.order.payment_status], refundLabel: labels[state.order.refund_status], fulfillmentLabel: labels[state.order.fulfillment_status] });
      }
      if (page === "MP17") {
        this.setData({ policy: await api("/privacy/policies?environment=" + env.provider + "_" + env.os, "GET", null, null, true) });
        const deletionId = (_r = (_q = this.data.deletion) == null ? void 0 : _q.deletion_request_id) != null ? _r : deletionReference();
        if (deletionId) this.setData({ deletion: await api("/data-deletion-requests/" + deletionId) });
      }
      if (page === "MP18" && state.correction) this.setData({ category: "\u5E73\u53F0\u7EA0\u9519", notice: "\u8BF7\u8BF4\u660E\u539F\u8D44\u6599\u4E2D\u7684\u9057\u6F0F\u6216\u9519\u8BEF\uFF0C\u5E76\u9009\u62E9\u662F\u5426\u6388\u6743\u552E\u540E\u9650\u65F6\u6838\u5BF9\u5F53\u524D\u4EFB\u52A1\u3002\u5BA1\u6838\u53EA\u8986\u76D6\u5DF2\u786E\u8BA4\u7684\u539F\u8D44\u6599\u7EA0\u9519\u8303\u56F4\u3002" });
      remember();
      if (this.visible && (((_s = state.session) == null ? void 0 : _s.status) === "INITIALIZING" || page === "MP10" && ((_t = state.reworkSession) == null ? void 0 : _t.status) === "INITIALIZING" || page === "MP05" && state.session && !["CLOSED", "FAILED", "CANCELED", "INITIALIZATION_FAILED", "WAITING_CONFIRMATION", "QUOTABLE", "AWAITING_PAYMENT"].includes(state.session.status))) {
        clearTimeout(this.poller);
        this.poller = setTimeout(() => {
          if (this.visible) this.perform(() => this.refresh());
        }, 2500);
      }
    },
    onAction(e) {
      var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j;
      const action = (_e = (_b2 = (_a2 = e.detail) == null ? void 0 : _a2.action) != null ? _b2 : e.action) != null ? _e : (_d = (_c = e.currentTarget) == null ? void 0 : _c.dataset) == null ? void 0 : _d.action, id = (_j = (_g = (_f = e.detail) == null ? void 0 : _f.id) != null ? _g : e.id) != null ? _j : (_i = (_h = e.currentTarget) == null ? void 0 : _h.dataset) == null ? void 0 : _i.id;
      this.perform(() => this.act(action, id));
    },
    async act(action, id) {
      var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j;
      if (action === "refresh") {
        await this.refresh();
        return;
      }
      if (action === "toggle-files") {
        this.setData({ moreFiles: !this.data.moreFiles });
        return;
      }
      if (action === "toggle-record") {
        this.setData({ expandedRecord: this.data.expandedRecord === id ? "" : id });
        return;
      }
      if (action === "edit-field") {
        this.setData({ expandedField: this.data.expandedField === id ? "" : id });
        return;
      }
      if (action === "prepare-correction") {
        const r = await businessTransport("/runs/" + state.run.run_id + "/correction-sessions", "POST", { client_request_id: this.key("correction-request"), skill_release_id: config_generated_default.skillReleaseId }, this.key("correction-session"));
        this.done("correction-session");
        clearDraft();
        state.correction = true;
        state.session = await api("/agent-sessions/" + r.session_id);
        remember();
        await navigate("MP01");
        return;
      }
      if (action === "start-correction") {
        const authorization = (_a2 = this.data.correction) == null ? void 0 : _a2.authorization;
        if ((authorization == null ? void 0 : authorization.status) !== "APPROVED" || !((_b2 = state.quote) == null ? void 0 : _b2.quote_id)) throw new Error("\u8BF7\u5148\u67E5\u770B\u4F30\u8D39\uFF0C\u5E76\u7B49\u5F85\u539F\u5355\u7EA0\u9519\u5BA1\u6838\u901A\u8FC7\u3002");
        const p = await readPlan();
        state.run = await businessTransport("/corrections/" + authorization.authorization_id + "/runs", "POST", { session_id: state.session.session_id, contract_id: p.contract_id, plan_hash: p.plan.plan_hash, quote_id: state.quote.quote_id }, this.key("start-correction"));
        this.done("start-correction");
        remember();
        await navigate("MP05");
        return;
      }
      if (action === "add-field" || action === "remove-field" || action === "field-up" || action === "field-down" || (action == null ? void 0 : action.startsWith("field-toggle-")) || (action == null ? void 0 : action.startsWith("field-type-")) || action === "remove-rule" || action === "add-rule") {
        const draft = clone(this.data.draft);
        if (!draft) throw new Error("\u8BF7\u7B49\u5F85\u89C4\u8303\u52A0\u8F7D\u3002");
        const index = draft.fields.findIndex((f) => f.field_id === id), field = draft.fields[index];
        if (action === "add-field") {
          if (draft.fields.length >= 50) throw new Error("\u672C\u6B21\u89C4\u8303\u6700\u591A\u5305\u542B 50 \u4E2A\u5B57\u6BB5\u3002");
          draft.fields.push({ field_id: "field_" + uuid(), label: "\u65B0\u5B57\u6BB5 " + (draft.fields.length + 1), order: draft.fields.length, type: "TEXT", required: false, nullable: true, unit: null, description: "" });
        }
        if (action === "remove-field") {
          if (draft.identity_keys.includes(id)) throw new Error("\u8BE5\u5B57\u6BB5\u7528\u4E8E\u8BC6\u522B\u8BB0\u5F55\uFF0C\u8BF7\u901A\u8FC7\u6587\u5B57\u8C03\u6574\u8BF4\u660E\u540C\u65F6\u4FEE\u6539\u8BC6\u522B\u89C4\u5219\u3002");
          draft.fields = draft.fields.filter((f) => f.field_id !== id);
        }
        if (action === "field-up" && index > 0) [draft.fields[index - 1], draft.fields[index]] = [draft.fields[index], draft.fields[index - 1]];
        if (action === "field-down" && index >= 0 && index < draft.fields.length - 1) [draft.fields[index + 1], draft.fields[index]] = [draft.fields[index], draft.fields[index + 1]];
        if ((action == null ? void 0 : action.startsWith("field-toggle-")) && field) {
          const property = action.slice(13);
          field[property] = !field[property];
        }
        if ((action == null ? void 0 : action.startsWith("field-type-")) && field) {
          field.type = action.slice(11);
          delete field.scale;
          delete field.enum_values;
          delete field.closed_enum;
          if (field.type === "ENUM") {
            field.enum_values = [];
            field.closed_enum = true;
          }
        }
        if (action === "remove-rule") draft.rules.splice(Number(id), 1);
        if (action === "add-rule") draft.rules.push(ruleFromForm(draft, this.data));
        draft.fields.forEach((f, i) => {
          f.order = i;
        });
        this.setData(editorView(draft));
        return;
      }
      if (action == null ? void 0 : action.startsWith("rule-kind-")) {
        this.setData({ ruleKind: action.slice(10) });
        return;
      }
      if (action == null ? void 0 : action.startsWith("rule-compare-")) {
        this.setData({ ruleComparator: action.slice(13) });
        return;
      }
      if (action === "rule-field" || action === "rule-target") {
        this.setData({ [action === "rule-field" ? "ruleField" : "ruleTarget"]: id });
        return;
      }
      if (action === "edit-template") {
        await navigate("MP07", { template: id });
        return;
      }
      if (action === "save-template-version") {
        if (!this.data.name.trim()) throw new Error("\u8BF7\u586B\u5199\u89C4\u8303\u540D\u79F0\u3002");
        if (!await confirm("\u4FDD\u5B58\u89C4\u8303\u7684\u65B0\u7248\u672C", "\u8BF7\u786E\u8BA4\u5B57\u6BB5\u8BF4\u660E\u548C\u89C4\u5219\u4E2D\u6CA1\u6709\u5177\u4F53\u8BB0\u5F55\u6216\u4E2A\u4EBA\u8D44\u6599\u3002\u5386\u53F2\u4EFB\u52A1\u4ECD\u4F7F\u7528\u5404\u81EA\u5DF2\u786E\u8BA4\u7684\u7248\u672C\u3002", "\u4FDD\u5B58\u65B0\u7248\u672C")) return;
        const policy = await api("/privacy/policies?environment=" + environment().provider + "_" + environment().os, "GET", null, null, true);
        const consent = await this.write("template-version-consent", "/privacy/consents", { policy_version: policy.policy_version, scopes: ["SAVE_PRIVATE_TEMPLATE"], action: "GRANT" });
        const template = state.selectedTemplate;
        await this.write("template-version", "/private-templates/" + template.template_id + "/versions", { expected_template_version: template.version, name: this.data.name, schema: this.data.draft, policy_consent_id: consent.consent_id });
        await navigate("MP14");
        return;
      }
      if (action === "filter-blocker" || action === "filter-all") {
        this.setData({ filter: action === "filter-blocker" ? "BLOCKER" : "" });
        await this.refresh();
        return;
      }
      if (action === "mode-discover" || action === "mode-provided") {
        if (state.task) throw new Error("\u5F53\u524D\u4EFB\u52A1\u5DF2\u7ECF\u63D0\u4EA4\uFF0C\u5207\u6362\u6A21\u5F0F\u8BF7\u65B0\u5EFA\u4F1A\u8BDD\u3002");
        state.draftMode = action === "mode-discover" ? "DISCOVER" : "PROVIDED";
        this.setData({ mode: state.draftMode });
        return;
      }
      if (action == null ? void 0 : action.startsWith("go-")) {
        await navigate(action.slice(3));
        return;
      }
      if (action === "new") {
        if (state.session && !["CLOSED", "FAILED", "CANCELED", "INITIALIZATION_FAILED"].includes(state.session.status)) {
          if (!await confirm("\u5DF2\u6709\u6574\u7406\u4F1A\u8BDD", "\u7EE7\u7EED\u65B0\u5EFA\u4F1A\u8BDD\u524D\u5173\u95ED\u5F53\u524D\u4F1A\u8BDD\u3002\u539F\u59CB\u8D44\u6599\u4F1A\u6E05\u7406\uFF0C\u5DF2\u4FDD\u5B58\u7ED3\u679C\u7EE7\u7EED\u4FDD\u7559\u3002", "\u5173\u95ED\u5E76\u65B0\u5EFA")) return;
          await this.write("close-old", "/agent-sessions/" + state.session.session_id + "/close", { expected_version: state.session.version, reason: "\u7528\u6237\u65B0\u5EFA\u6574\u7406\u4F1A\u8BDD" });
        }
        clearDraft();
        const r = await this.write("new", "/agent-sessions", { client_request_id: this.key("session-request"), skill_release_id: config_generated_default.skillReleaseId });
        state.session = await api("/agent-sessions/" + r.session_id);
        this.setData({ text: "", goal: "", notice: "\u6B63\u5728\u51C6\u5907\u4F1A\u8BDD\uFF0C\u5B8C\u6210\u540E\u5373\u53EF\u63D0\u4EA4\u8D44\u6599\u3002" });
        await this.refresh();
        return;
      }
      if (action === "add-text") {
        const task = await this.ensureTask();
        if (!this.data.text.trim()) throw new Error("\u8BF7\u5148\u7C98\u8D34\u9700\u8981\u6574\u7406\u7684\u6587\u5B57\u3002");
        await this.write("add-text", "/tasks/" + task.task_id + "/sources", { role: "SOURCE", text: this.data.text, expected_task_version: task.version });
        this.setData({ text: "", notice: "\u6587\u5B57\u8D44\u6599\u5DF2\u63A5\u6536\u3002" });
        await this.refresh();
        return;
      }
      if (action === "add-image" || action === "add-office" || action === "add-template") {
        if (!((_c = state.capability) == null ? void 0 : _c.flags[action === "add-template" ? "template_input" : "file_input"])) throw new Error("\u5F53\u524D\u5E73\u53F0\u6784\u5EFA\u5C1A\u672A\u5F00\u653E\u6587\u4EF6\u5165\u53E3\uFF0C\u53EF\u5148\u7C98\u8D34\u6587\u5B57\u3002");
        const task = await this.ensureTask(), selected = action === "add-image" ? await chooseImage() : await chooseOffice();
        if (!selected.path) throw new Error("\u672A\u9009\u62E9\u6587\u4EF6\u3002");
        const bytes = await fileBytes(selected.path), role = action === "add-template" ? "TEMPLATE" : "SOURCE";
        if (bytes.length > (role === "TEMPLATE" ? 5e6 : 2e7)) throw new Error("\u6587\u4EF6\u8D85\u8FC7\u672C\u6B21\u5927\u5C0F\u9650\u5236\u3002");
        const png = bytes[0] === 137 && bytes[1] === 80, jpeg = bytes[0] === 255 && bytes[1] === 216, pdf = bytes[0] === 37 && bytes[1] === 80, zip = bytes[0] === 80 && bytes[1] === 75;
        const ext = selected.name.toLowerCase().split(".").pop(), mime = png ? "image/png" : jpeg ? "image/jpeg" : pdf ? "application/pdf" : zip && ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : zip ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : ext === "csv" ? "text/csv" : "text/plain";
        const grant = await this.write("upload-grant", "/tasks/" + task.task_id + "/upload-sessions", { name: selected.name, bytes: bytes.length, sha256: sha256(bytes), mime, role });
        const observed = await upload(selected.path, grant);
        const completed = await this.write("upload-complete", "/uploads/" + grant.upload_id + "/complete", { observed_hash: observed.observed_sha256 });
        if (role === "TEMPLATE") await this.write("standard", "/tasks/" + task.task_id + "/standard", { expected_task_version: (await refreshTask()).version, template_source_id: completed.source_id });
        else await this.write("link-source", "/tasks/" + task.task_id + "/sources", { role: "SOURCE", source_id: completed.source_id, expected_task_version: (await refreshTask()).version });
        await this.refresh();
        return;
      }
      if (action === "remove-source") {
        if (!await confirm("\u79FB\u9664\u8D44\u6599", "\u53EA\u4ECE\u5F53\u524D\u4EFB\u52A1\u7684\u786E\u8BA4\u8303\u56F4\u79FB\u9664\u6B64\u9879\uFF0C\u540E\u7EED\u65B9\u6848\u4E0E\u8D39\u7528\u9700\u8981\u91CD\u65B0\u786E\u8BA4\u3002", "\u79FB\u9664\u8D44\u6599")) return;
        await api("/tasks/" + state.task.task_id + "/sources/" + id + "?expected_task_version=" + state.task.version, "DELETE", null, this.key("remove-" + id));
        this.done("remove-" + id);
        await this.refresh();
        return;
      }
      if (action === "clear-sources") {
        if (!writable()) throw new Error("\u5F53\u524D\u4F1A\u8BDD\u4E0D\u53EF\u8C03\u6574\u8D44\u6599\u3002");
        const sources = (_e = (_d = state.task) == null ? void 0 : _d.sources.filter((s) => s.role !== "TEMPLATE")) != null ? _e : [];
        if (!sources.length) return;
        if (!await confirm("\u6E05\u7A7A\u6765\u6E90\u8D44\u6599", "\u79FB\u9664\u672C\u6B21\u5168\u90E8\u6765\u6E90\u8D44\u6599\uFF1B\u89C4\u8303\u6587\u4EF6\u4FDD\u7559\u3002\u540E\u7EED\u65B9\u6848\u548C\u672A\u4ED8\u62A5\u4EF7\u9700\u8981\u91CD\u65B0\u786E\u8BA4\u3002", "\u6E05\u7A7A\u8D44\u6599")) return;
        try {
          for (const source of sources) {
            await refreshTask();
            await api("/tasks/" + state.task.task_id + "/sources/" + source.source_id + "?expected_task_version=" + state.task.version, "DELETE", null, this.key("remove-" + source.source_id));
            this.done("remove-" + source.source_id);
          }
        } finally {
          await this.refresh();
        }
        return;
      }
      if (action === "analyze") {
        const task = await this.ensureTask();
        if (!state.consent) {
          await navigate("MP17");
          this.setData({ notice: "\u8BF7\u5148\u9605\u8BFB\u5E76\u786E\u8BA4\u8D44\u6599\u5904\u7406\u7528\u9014\uFF0C\u518D\u56DE\u6765\u5F00\u59CB\u5206\u6790\u3002" });
          return;
        }
        await this.write("analyze", "/tasks/" + task.task_id + "/preflight", { agent_session_id: state.session.session_id, source_set_version: task.source_set_version, goal_version: task.goal_version });
        await navigate("MP05");
        return;
      }
      if (action === "use-template") {
        state.selectedTemplate = await api("/private-templates/" + id);
        if (!writable()) {
          await navigate("MP01");
          this.setData({ notice: "\u5DF2\u9009\u62E9\u89C4\u8303\u3002\u8BF7\u5148\u65B0\u5EFA\u4F1A\u8BDD\u3002" });
          return;
        }
        const task = await this.ensureTask();
        await this.write("use-template", "/tasks/" + task.task_id + "/standard", { fields_schema: state.selectedTemplate.schema, expected_task_version: task.version });
        await navigate("MP03");
        return;
      }
      if (action === "adopt") {
        const p = state.proposal, t = await refreshTask();
        if (!p) throw new Error("\u89C4\u8303\u8349\u6848\u5C1A\u672A\u51C6\u5907\u597D\u3002");
        await this.write("adopt", "/tasks/" + t.task_id + "/schema-adoptions", { session_id: state.session.session_id, expected_proposal_version: p.version, expected_source_set_version: t.source_set_version, expected_goal_version: t.goal_version });
        await navigate("MP04");
        return;
      }
      if (action === "revise-schema") {
        if (!this.data.instruction.trim()) throw new Error("\u8BF7\u8BF4\u660E\u9700\u8981\u8C03\u6574\u7684\u5B57\u6BB5\u3001\u89C4\u5219\u6216\u4E00\u884C\u4EE3\u8868\u7684\u5BF9\u8C61\u3002");
        await this.write("revise-schema", "/tasks/" + state.task.task_id + "/schema-proposal/revisions", { expected_proposal_version: state.proposal.version, instruction: this.data.instruction });
        this.setData({ notice: "\u8C03\u6574\u8981\u6C42\u5DF2\u63D0\u4EA4\uFF0C\u5B8C\u6210\u540E\u8BF7\u91CD\u65B0\u5BA1\u9605\u3002" });
        await navigate("MP05");
        return;
      }
      if (action === "save-schema-edit") {
        const patch = schemaPatch(this.originalSchema, this.data.draft);
        if (!patch.length) throw new Error("\u8FD8\u6CA1\u6709\u4FEE\u6539\u5B57\u6BB5\u3001\u89C4\u5219\u6216\u884C\u5BF9\u8C61\u3002");
        await this.write("structured-schema-edit", "/tasks/" + state.task.task_id + "/schema-proposal/revisions", { expected_proposal_version: state.proposal.version, patch });
        state.quote = null;
        state.confirmation = null;
        await navigate("MP05");
        return;
      }
      if (action === "confirm-plan") {
        if (!state.consent) throw new Error("\u8BF7\u5148\u5728\u9690\u79C1\u4E0E\u6570\u636E\u7BA1\u7406\u4E2D\u786E\u8BA4\u8D44\u6599\u5904\u7406\u7528\u9014\u3002");
        const t = await refreshTask(), p = await readPlan();
        if (!p.binding_id) throw new Error("\u8BF7\u5148\u91C7\u7528\u672C\u6B21\u63A8\u8350\u89C4\u8303\u3002");
        if (p.contract_id) state.confirmation = { contract_id: p.contract_id, contract_hash: p.contract_hash, confirmed_plan: p.plan };
        else state.confirmation = await this.write("confirm-plan", "/tasks/" + t.task_id + "/confirmations", {
          session_id: state.session.session_id,
          plan_id: p.plan.plan_id,
          plan_version: p.plan.version,
          plan_hash: p.plan.plan_hash,
          binding_id: p.binding_id,
          policy_consent_id: state.consent,
          expected_versions: { task_version: t.version, source_set_version: t.source_set_version, goal_version: t.goal_version }
        });
        state.quote = await this.write("quote", "/tasks/" + t.task_id + "/quotes", { session_id: state.session.session_id, contract_id: state.confirmation.contract_id, confirmed_plan_id: p.plan.plan_id, plan_hash: p.plan.plan_hash, origin_environment: environment() });
        this.setData({ quote: state.quote, notice: state.quote.access_mode === "PAID" ? "\u8BF7\u6838\u5BF9\u8D39\u7528\u4E0E\u4EA4\u4ED8\u5185\u5BB9\uFF0C\u518D\u5230\u539F\u5E73\u53F0\u4ED8\u6B3E\u3002" : "\u5F53\u524D\u73AF\u5883\u5C1A\u672A\u5F00\u653E\u6536\u8D39\u6279\u91CF\u4EA7\u51FA\u3002" });
        await this.refresh();
        return;
      }
      if (action === "close-session") {
        if (!state.session || !await confirm("\u7ED3\u675F\u672C\u6B21\u4F1A\u8BDD", "\u5C06\u505C\u6B62\u5E76\u6E05\u7406\u672C\u6B21\u4E34\u65F6\u8D44\u6599\u4E0E\u73AF\u5883\u3002\u5DF2\u4FDD\u5B58\u7ED3\u679C\u4FDD\u7559\uFF1B\u82E5\u539F\u5E73\u53F0\u4E4B\u540E\u786E\u8BA4\u4ED8\u6B3E\uFF0C\u5C06\u6838\u5BF9\u539F\u8BA2\u5355\u9000\u6B3E\u3002", "\u7ED3\u675F\u4F1A\u8BDD")) return;
        await this.write("close-session", "/agent-sessions/" + state.session.session_id + "/close", { expected_version: state.session.version, reason: "\u7528\u6237\u7ED3\u675F\u672C\u6B21\u4F1A\u8BDD" });
        await this.refresh();
        return;
      }
      if (action === "checkout" || action === "continue-checkout") {
        if (state.correction) throw new Error("\u539F\u5355\u7EA0\u9519\u8BF7\u8D70\u552E\u540E\u5BA1\u6838\u4E0E\u539F\u5B9E\u4ED8\u6743\u76CA\u6838\u9A8C\u3002");
        if (!state.order) {
          if (!((_f = state.quote) == null ? void 0 : _f.quote_id) || !state.confirmation) throw new Error("\u8BF7\u5148\u786E\u8BA4\u5F53\u524D\u65B9\u6848\u4E0E\u8D39\u7528\u3002");
          state.order = await this.write("order", "/orders", { quote_id: state.quote.quote_id, contract_hash: state.confirmation.contract_hash });
          remember();
        }
        const checkout = await this.write("checkout", "/orders/" + state.order.order_id + "/checkout", { expected_channel: provider });
        try {
          await pay(checkout.provider_checkout_payload);
        } finally {
          state.order = await api("/orders/" + state.order.order_id);
          remember();
          this.setData({ order: state.order, notice: "\u6536\u94F6\u64CD\u4F5C\u5DF2\u8FD4\u56DE\u3002\u662F\u5426\u5B9E\u4ED8\u4EE5\u539F\u5E73\u53F0\u67E5\u5355\u4E3A\u51C6\u3002" });
        }
        return;
      }
      if (action === "start-run") {
        if (!state.order) throw new Error("\u8BF7\u5148\u67E5\u8BE2\u539F\u8BA2\u5355\u3002");
        state.order = await api("/orders/" + state.order.order_id);
        if (state.order.payment_status !== "CONFIRMED") throw new Error("\u539F\u5E73\u53F0\u5C1A\u672A\u786E\u8BA4\u4ED8\u6B3E\uFF0C\u8BF7\u7A0D\u540E\u67E5\u8BE2\u3002");
        const context = await orderContext(state.order.order_id);
        state.task = await api("/tasks/" + context.task_id);
        state.session = await api("/agent-sessions/" + context.session_id);
        const p = await readPlan();
        state.run = await this.write("start-run", "/tasks/" + state.task.task_id + "/runs", { session_id: state.session.session_id, contract_id: p.contract_id, order_id: state.order.order_id, confirmed_plan_hash: p.plan.plan_hash });
        remember();
        await navigate("MP05");
        return;
      }
      if (action === "view-task") {
        state.task = await api("/tasks/" + id);
        state.session = await api("/agent-sessions/" + state.task.agent_session_id);
        state.run = null;
        state.proposal = null;
        remember();
        await navigate(state.task.current_result_version ? "MP08" : "MP05");
        return;
      }
      if (action === "view-order") {
        state.order = await api("/orders/" + id);
        const c = await orderContext(id);
        state.task = await api("/tasks/" + c.task_id);
        state.session = await api("/agent-sessions/" + c.session_id);
        state.run = null;
        state.proposal = null;
        state.quote = null;
        state.confirmation = null;
        state.resultSchema = null;
        remember();
        await navigate("MP16", { order: id });
        return;
      }
      if (action === "issue") {
        state.selectedIssue = this.data.issues.find((i) => i.issue_id === id);
        await navigate("MP10");
        return;
      }
      if (action === "evidence") {
        await navigate("MP11", { evidence: id });
        return;
      }
      if (action === "decision-preview") {
        const i = this.data.issue;
        if (!this.data.selectedAction) throw new Error("\u8BF7\u9009\u62E9\u8865\u5145\u3001\u6765\u6E90\u9009\u9879\u6216\u7EE7\u7EED\u4FDD\u7559\u5F85\u786E\u8BA4\u3002");
        let d = { issue_id: i.issue_id, record_id: i.record_id, field_id: i.field_id, action: this.data.selectedAction };
        if (d.action === "USER_VALUE") {
          if (!this.data.value.trim()) throw new Error("\u8BF7\u8F93\u5165\u660E\u786E\u7684\u8865\u5145\u503C\u3002");
          const field = (_g = state.resultSchema) == null ? void 0 : _g.fields.find((f) => f.field_id === i.field_id);
          let value = this.data.value;
          if ((field == null ? void 0 : field.type) === "INTEGER") {
            value = Number(value);
            if (!Number.isSafeInteger(value)) throw new Error("\u8BF7\u63D0\u4F9B\u6709\u6548\u7684\u5B89\u5168\u6574\u6570\u3002");
          }
          if ((field == null ? void 0 : field.type) === "BOOLEAN") {
            if (!["true", "false"].includes(value)) throw new Error("\u5E03\u5C14\u5B57\u6BB5\u586B\u5199 true \u6216 false\u3002");
            value = value === "true";
          }
          d.user_value = value;
        }
        if (d.action === "CHOOSE_EVIDENCE") d.evidence_id = this.data.selectedEvidence;
        const r = await this.write("decision-preview", "/runs/" + state.run.run_id + "/decision-previews", { expected_result_version: state.run.result_version, decisions: [d], scope: { target_record_ids: [i.record_id] } });
        this.setData({ decisionPreview: r });
        return;
      }
      if (action === "decision-submit") {
        const p = this.data.decisionPreview;
        if (!p) throw new Error("\u8BF7\u5148\u9884\u89C8\u672C\u6B21\u4FEE\u6539\u5F71\u54CD\u3002");
        const r = await this.write("decision-submit", "/runs/" + state.run.run_id + "/decisions", { preview_id: p.preview_id, preview_hash: p.preview_hash, expected_result_version: state.run.result_version });
        clearDraft();
        state.session = await api("/agent-sessions/" + r.new_session_id);
        remember();
        await navigate("MP01");
        return;
      }
      if (action === "copy-file-link") {
        if (!((_h = state.capability) == null ? void 0 : _h.flags.export)) throw new Error("\u5F53\u524D\u6784\u5EFA\u5C1A\u672A\u901A\u8FC7\u7ED3\u679C\u9886\u53D6\u80FD\u529B\u9A8C\u8BC1\u3002");
        const file = this.data.files.find((f) => f.artifact_id === id);
        if (!file) throw new Error("\u8BF7\u5237\u65B0\u6587\u4EF6\u5217\u8868\u3002");
        if (!await confirm("\u590D\u5236\u6B64\u6587\u4EF6\u7684\u77ED\u671F\u9886\u53D6\u94FE\u63A5", "\u6B64\u94FE\u63A5\u4E94\u5206\u949F\u5185\u6709\u6548\uFF0C\u6301\u6709\u94FE\u63A5\u7684\u4EBA\u53EF\u4EE5\u9886\u53D6\u8BE5\u6587\u4EF6\u3002\u8BF7\u53EA\u5728\u81EA\u5DF1\u7684\u8BBE\u5907\u6216\u53EF\u4FE1\u63A5\u6536\u65B9\u4F7F\u7528\u3002", "\u590D\u5236\u94FE\u63A5")) return;
        const link = await this.write("copy-link-" + id, "/artifacts/" + id + "/download-link", { expected_result_version: state.run.result_version });
        await copyFileLink(link.signed_url);
        this.setData({ notice: "\u5DF2\u590D\u5236\u4E94\u5206\u949F\u9886\u53D6\u94FE\u63A5\uFF0C\u53EF\u5728\u81EA\u5DF1\u7684\u6D4F\u89C8\u5668\u9886\u53D6\u6587\u4EF6\u3002\u5230\u671F\u540E\u53EF\u518D\u6B21\u751F\u6210\uFF1B\u672C\u6B21\u590D\u5236\u4E0D\u8868\u793A\u6587\u4EF6\u5DF2\u7ECF\u4FDD\u5B58\u3002" });
        return;
      }
      if (action === "download") {
        if (!((_i = state.capability) == null ? void 0 : _i.flags.export)) throw new Error("\u5F53\u524D\u6784\u5EFA\u5C1A\u672A\u901A\u8FC7\u7ED3\u679C\u9886\u53D6\u80FD\u529B\u9A8C\u8BC1\uFF0C\u8BF7\u4FDD\u7559\u4EFB\u52A1\u540E\u7A0D\u540E\u9886\u53D6\u3002");
        const file = this.data.files.find((f) => f.artifact_id === id), attempt = uuid();
        if (!file) throw new Error("\u6587\u4EF6\u4FE1\u606F\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u5237\u65B0\u3002");
        const observe = async (status) => this.write("export-" + status, "/artifacts/" + id + "/export-attempts", { client_attempt_id: attempt, observed_action: status, receipt_source: "CLIENT", environment: environment(), observed_at: (/* @__PURE__ */ new Date()).toISOString() });
        const link = await this.write("download-link", "/artifacts/" + id + "/download-link", { expected_result_version: state.run.result_version });
        this.localFile = await fetchFile(link.signed_url);
        await observe("FETCHED");
        const bytes = await fileBytes(this.localFile);
        if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error("\u6587\u4EF6\u5B8C\u6574\u6027\u6821\u9A8C\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u9886\u53D6\u3002");
        this.setData({ notice: "\u6587\u4EF6\u5DF2\u4E0B\u8F7D\u5E76\u6821\u9A8C\u3002\u6253\u5F00\u6587\u4EF6\u4E0D\u7B49\u4E8E\u5DF2\u7ECF\u4FDD\u5B58\u5230\u5176\u4ED6\u4F4D\u7F6E\u3002" });
        this.lastDownload = { file, attempt };
        if (file.name.endsWith(".xlsx")) {
          await observe("OPEN_REQUESTED");
          await openFile(this.localFile);
          await observe("OPENED");
        }
        return;
      }
      if (action === "saved-confirmed") {
        if (!this.localFile || !this.lastDownload) throw new Error("\u8BF7\u5148\u9886\u53D6\u6587\u4EF6\u3002");
        const { file, attempt } = this.lastDownload;
        await this.write("export-user-confirmed", "/artifacts/" + file.artifact_id + "/export-attempts", { client_attempt_id: attempt, observed_action: "USER_CONFIRMED", receipt_source: "USER", environment: environment(), observed_at: (/* @__PURE__ */ new Date()).toISOString() });
        this.setData({ notice: "\u5DF2\u8BB0\u5F55\u4F60\u7684\u4FDD\u5B58\u786E\u8BA4\u3002\u7ED3\u679C\u6587\u4EF6\u4ECD\u53EF\u4ECE\u6B64\u4EFB\u52A1\u518D\u6B21\u9886\u53D6\u3002" });
        return;
      }
      if (action === "save-template") {
        if (!this.data.name.trim()) throw new Error("\u8BF7\u586B\u5199\u89C4\u8303\u540D\u79F0\u3002");
        const policy = await api("/privacy/policies?environment=" + environment().provider + "_" + environment().os, "GET", null, null, true);
        if (!await confirm("\u4FDD\u5B58\u4E3A\u6211\u7684\u89C4\u8303", "\u4EC5\u4FDD\u5B58\u5B57\u6BB5\u548C\u89C4\u5219\u3002\u8BF7\u786E\u8BA4\u540D\u79F0\u3001\u5B57\u6BB5\u8BF4\u660E\u4E0E\u89C4\u5219\u4E2D\u6CA1\u6709\u672C\u6B21\u5177\u4F53\u4E8B\u5B9E\u6216\u4E2A\u4EBA\u8D44\u6599\u3002", "\u4FDD\u5B58\u89C4\u8303")) return;
        const consent = await this.write("template-consent", "/privacy/consents", { policy_version: policy.policy_version, scopes: ["SAVE_PRIVATE_TEMPLATE"], action: "GRANT" });
        await this.write("save-template", "/private-templates", { binding_id: state.run.binding_id, name: this.data.name, policy_consent_id: consent.consent_id });
        this.setData({ notice: "\u89C4\u8303\u5DF2\u4FDD\u5B58\uFF0C\u4EC5\u5F53\u524D\u8D26\u53F7\u53EF\u89C1\u3002" });
        return;
      }
      if (action === "delete-template") {
        const t = this.data.templates.find((x) => x.template_id === id);
        if (!await confirm("\u5220\u9664\u79C1\u6709\u89C4\u8303", "\u505C\u6B62\u4EE5\u540E\u590D\u7528\u6B64\u89C4\u8303\u3002\u5DF2\u7ECF\u7ED1\u5B9A\u7684\u5386\u53F2\u4EFB\u52A1\u5FEB\u7167\u7EE7\u7EED\u4FDD\u7559\u3002", "\u5220\u9664\u89C4\u8303")) return;
        await api("/private-templates/" + id + "?expected_template_version=" + t.version, "DELETE", null, this.key("delete-template-" + id));
        this.done("delete-template-" + id);
        await this.refresh();
        return;
      }
      if (action === "consent" || action === "withdraw") {
        const r = await this.write("process-consent", "/privacy/consents", { policy_version: this.data.policy.policy_version, scopes: ["PROCESS_DATA"], action: action === "consent" ? "GRANT" : "WITHDRAW" });
        state.consent = action === "consent" ? r.consent_id : null;
        this.setData({ notice: action === "consent" ? "\u5DF2\u786E\u8BA4\u8D44\u6599\u5904\u7406\u7528\u9014\uFF0C\u8BF7\u8FD4\u56DE\u7EE7\u7EED\u6574\u7406\u3002" : "\u5DF2\u64A4\u56DE\u65B0\u7684\u8D44\u6599\u5904\u7406\u6388\u6743\uFF0C\u8FD0\u884C\u4E2D\u7684\u4EFB\u52A1\u5C06\u505C\u6B62\u5E76\u6E05\u7406\u3002" });
        return;
      }
      if (action === "delete-task" || action === "delete-account") {
        if (action === "delete-task" && !state.task) throw new Error("\u8BF7\u5148\u9009\u62E9\u9700\u8981\u5220\u9664\u7684\u4EFB\u52A1\u3002");
        if (!await confirm(action === "delete-task" ? "\u5220\u9664\u4EFB\u52A1\u8D44\u6599\u4E0E\u7ED3\u679C" : "\u6CE8\u9500\u8D26\u53F7", action === "delete-task" ? "\u7ACB\u5373\u64A4\u9500\u8BBF\u95EE\uFF0C\u5E76\u6E05\u7406\u672C\u4EFB\u52A1\u7684\u539F\u59CB\u8D44\u6599\u3001\u7ED3\u679C\u4E0E\u76F8\u5173\u6458\u5F55\u3002\u6B64\u64CD\u4F5C\u65E0\u6CD5\u6062\u590D\u3002" : "\u505C\u6B62\u5168\u90E8\u4EFB\u52A1\u5E76\u5220\u9664\u8D26\u53F7\u8D44\u6599\u3001\u7ED3\u679C\u548C\u79C1\u6709\u89C4\u8303\u3002\u5FC5\u8981\u652F\u4ED8\u3001\u9000\u6B3E\u548C\u5220\u9664\u51ED\u636E\u6309\u8BF4\u660E\u4FDD\u7559\u3002", "\u786E\u8BA4\u5220\u9664")) return;
        const r = await this.write("delete", "/data-deletion-requests", { resource_scope: { kind: action === "delete-task" ? "TASK_CONTENT" : "ACCOUNT", resource_ids: action === "delete-task" ? [state.task.task_id] : [] }, confirmation: true });
        rememberDeletion(r);
        clearDraft();
        this.setData({ deletion: r, task: null, session: null, records: [], sources: [], fields: [], draft: null, text: "", goal: "", note: "", notice: "\u8BBF\u95EE\u5DF2\u64A4\u9500\uFF0C\u6B63\u5728\u6E05\u7406\u6240\u9009\u8D44\u6599\u3002" });
        return;
      }
      if (action === "deletion-status") {
        if (this.data.deletion) this.setData({ deletion: await api("/data-deletion-requests/" + this.data.deletion.deletion_request_id) });
        return;
      }
      if (action === "retry-deletion") {
        const job = this.data.deletion;
        if (!job || job.status !== "PARTIAL_FAILED") return;
        const result = await businessTransport("/data-deletion-requests/" + job.deletion_request_id + "/retry", "POST", {}, this.key("retry-deletion"));
        this.done("retry-deletion");
        rememberDeletion(result);
        this.setData({ deletion: result });
        return;
      }
      if (action === "cancel") {
        if (!state.run) throw new Error("\u5F53\u524D\u6CA1\u6709\u751F\u4EA7\u4E2D\u7684\u4EFB\u52A1\u3002");
        if (!await confirm("\u505C\u6B62\u6574\u7406", "\u505C\u6B62\u540E\u4F1A\u6E05\u7406\u672C\u6B21\u73AF\u5883\uFF0C\u5DF2\u4FDD\u5B58\u7ED3\u679C\u4FDD\u7559\u3002\u672A\u4EA4\u4ED8\u90E8\u5206\u6309\u539F\u8BA2\u5355\u6838\u5BF9\u9000\u6B3E\u3002", "\u505C\u6B62\u6574\u7406")) return;
        await this.write("cancel", "/runs/" + state.run.run_id + "/cancel", { expected_run_version: state.run.version, reason: "\u7528\u6237\u505C\u6B62\u6574\u7406" });
        await this.refresh();
        return;
      }
      if (action === "refund") {
        if (!state.order) throw new Error("\u8BF7\u9009\u62E9\u539F\u8BA2\u5355\u3002");
        if (!await confirm("\u7533\u8BF7\u539F\u8DEF\u9000\u6B3E", "\u53EF\u9000\u91D1\u989D\u4E0E\u72B6\u6001\u4EE5\u539F\u652F\u4ED8\u5E73\u53F0\u6838\u9A8C\u4E3A\u51C6\u3002\u5904\u7406\u4E2D\u4E0D\u8868\u793A\u5DF2\u7ECF\u5230\u8D26\u3002", "\u7533\u8BF7\u9000\u6B3E")) return;
        await this.write("refund", "/orders/" + state.order.order_id + "/refund-requests", { reason: this.data.note || "\u7528\u6237\u7533\u8BF7\u9000\u6B3E", operation_reference: this.key("refund-reference") });
        await this.refresh();
        return;
      }
      if (action === "support") {
        if (!this.data.note.trim()) throw new Error("\u8BF7\u8BF4\u660E\u9047\u5230\u7684\u95EE\u9898\uFF0C\u8BF7\u52FF\u7C98\u8D34\u652F\u4ED8\u5BC6\u7801\u6216\u5BC6\u94A5\u3002");
        const r = await this.write("support", "/support/tickets", __spreadValues({ category: this.data.category, note: this.data.note, content_access_opt_in: this.data.supportAccess }, state.task ? { task_id: state.task.task_id, expected_task_version: state.task.version } : {}));
        this.setData({ notice: "\u95EE\u9898\u5DF2\u8BB0\u5F55\uFF0C\u7F16\u53F7 " + r.ticket_id, note: "" });
        return;
      }
      if (action === "support-access") {
        this.setData({ supportAccess: !this.data.supportAccess });
        return;
      }
      if (action === "load-more") {
        if (!this.data.nextCursor) return;
        const cursor = encodeURIComponent(this.data.nextCursor);
        let path, key;
        if (page === "MP13") {
          path = "/tasks?limit=20&cursor=" + cursor;
          key = "tasks";
        } else if (page === "MP14") {
          path = "/private-templates?limit=20&cursor=" + cursor + (this.data.name ? "&query=" + encodeURIComponent(this.data.name) : "");
          key = "templates";
        } else if (page === "MP15") {
          path = "/orders?limit=20&cursor=" + cursor;
          key = "orders";
        } else {
          key = page === "MP09" ? "issues" : "records";
          path = "/runs/" + state.run.run_id + "/" + key + "?result_version=" + state.run.result_version + "&limit=20&cursor=" + cursor + (this.data.filter ? "&severity=" + this.data.filter : "");
        }
        const r = await api(path), items = (_j = r.items) != null ? _j : r[key];
        this.setData({ [key]: [...this.data[key], ...key === "records" ? items.map((x) => recordView(x, state.resultSchema)) : items], nextCursor: r.next_cursor });
        return;
      }
      throw new Error("\u6B64\u64CD\u4F5C\u5F53\u524D\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5\u3002");
    }
  };
}
