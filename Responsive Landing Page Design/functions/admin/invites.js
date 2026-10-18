// The private dashboard page: /admin/invites (protected by functions/admin/_middleware.js).
// All data is loaded from /admin/api/* after the page opens; nothing is baked into the HTML.

export async function onRequestGet() {
  const nonce = crypto.randomUUID().replace(/-/g, "")
  return new Response(PAGE.replace(/__NONCE__/g, nonce), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": [
        "default-src 'none'",
        `script-src 'nonce-${nonce}'`,
        "style-src 'unsafe-inline'",
        "connect-src 'self'",
        "frame-src 'self'",
        "img-src 'self' data:",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join("; "),
    },
  })
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Invitations · ROUGE Admin</title>
<style>
  :root {
    color-scheme: dark;
    --bg:#100909; --panel:#170C0D; --panel2:#1E1012; --line:#33171C; --oxblood:#5A101C;
    --accent:#9A2538; --cream:#F2E9DF; --muted:#BFAEA6; --faint:#8E7E79;
    --ok:#9FC3A0; --warn:#E3B66B; --bad:#E0727F;
    --serif:"Bodoni 72", Didot, "Bodoni MT", Georgia, "Times New Roman", serif;
    --sans:"Helvetica Neue", Helvetica, Arial, sans-serif;
    --mono:Menlo, Consolas, "Courier New", monospace;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--cream); font-family:var(--sans); font-size:15px; line-height:1.5; }
  .wrap { max-width:1040px; margin:0 auto; padding:24px 16px 80px; }
  header { display:flex; flex-wrap:wrap; gap:8px 16px; align-items:baseline; justify-content:space-between; border-bottom:1px solid var(--line); padding-bottom:18px; }
  .crumbs { font-size:12px; letter-spacing:4px; color:var(--muted); }
  .crumbs b { font-family:var(--serif); font-weight:normal; font-size:20px; letter-spacing:8px; color:var(--cream); margin-right:4px; }
  .who { font-size:12px; color:var(--faint); }
  .campaign { margin:22px 0 6px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
  .campaign h1 { font-family:var(--serif); font-weight:normal; font-size:28px; margin:0; }
  .label { font-size:11px; letter-spacing:3px; text-transform:uppercase; color:var(--muted); }
  select { background:var(--panel); color:var(--cream); border:1px solid var(--line); padding:6px 8px; font:inherit; }
  .pill { display:inline-block; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; padding:3px 8px; border:1px solid var(--line); color:var(--muted); white-space:nowrap; }
  .pill.ok { color:var(--ok); border-color:#355238; } .pill.warn { color:var(--warn); border-color:#5b4724; }
  .pill.bad { color:var(--bad); border-color:#5e2a31; } .pill.live { color:var(--cream); border-color:var(--accent); background:var(--oxblood); }
  .notice { margin:16px 0; padding:12px 14px; border:1px solid #5b4724; color:var(--warn); background:#1b140b; font-size:14px; }
  .notice.bad { border-color:#5e2a31; color:var(--bad); background:#1d0d10; }
  .notice.ok { border-color:#355238; color:var(--ok); background:#0e1710; }
  .metrics { display:grid; grid-template-columns:repeat(2, 1fr); gap:1px; background:var(--line); border:1px solid var(--line); margin:20px 0; }
  .metric { background:var(--panel); padding:14px 14px 12px; }
  .metric .n { font-family:var(--serif); font-size:34px; line-height:1.1; }
  .metric .sub { font-size:12px; color:var(--faint); min-height:18px; }
  .metric:last-child { grid-column:1 / -1; }
  @media (min-width:720px) { .metrics { grid-template-columns:repeat(5, 1fr); } .metric:last-child { grid-column:auto; } }
  .steps { display:grid; gap:12px; margin:8px 0 28px; }
  @media (min-width:720px) { .steps { grid-template-columns:repeat(2, 1fr); } }
  .step { background:var(--panel); border:1px solid var(--line); padding:16px; }
  .step h2 { margin:0 0 4px; font-size:12px; letter-spacing:3px; font-weight:normal; color:var(--muted); }
  .step p { margin:0 0 12px; color:var(--muted); font-size:14px; }
  .step.done { border-color:#355238; }
  button { font:inherit; font-size:12px; letter-spacing:3px; text-transform:uppercase; padding:13px 18px; cursor:pointer;
           background:transparent; color:var(--cream); border:1px solid var(--cream); min-height:44px; }
  button.primary { background:var(--accent); border-color:var(--accent); }
  button:disabled { opacity:.35; cursor:not-allowed; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline:2px solid var(--cream); outline-offset:2px; }
  .row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  label.check { display:flex; gap:10px; align-items:flex-start; font-size:14px; color:var(--cream); margin:0 0 12px; }
  label.check input { margin-top:3px; width:18px; height:18px; accent-color:var(--accent); flex:none; }
  .msg { margin-top:10px; font-size:13px; }
  .msg.ok { color:var(--ok); } .msg.bad { color:var(--bad); }
  #previewPanel { display:none; margin:0 0 28px; border:1px solid var(--line); background:var(--panel); }
  #previewPanel .bar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid var(--line); }
  #previewPanel iframe { display:block; width:100%; height:1500px; border:0; background:#100909; }
  #previewPanel pre { margin:0; padding:16px; white-space:pre-wrap; font-family:var(--mono); font-size:13px; color:var(--cream); max-height:900px; overflow:auto; }
  .seg button { padding:8px 12px; min-height:36px; font-size:11px; border-color:var(--line); }
  .seg button[aria-pressed="true"] { border-color:var(--cream); }
  h3 { font-family:var(--serif); font-weight:normal; font-size:22px; margin:0 0 12px; }
  .list { border-top:1px solid var(--line); }
  .sub-row { display:grid; grid-template-columns:1fr auto; gap:4px 12px; padding:12px 2px; border-bottom:1px solid var(--line); }
  .sub-row .name { font-size:15px; }
  .sub-row .email { font-size:13px; color:var(--faint); word-break:break-all; }
  .sub-row .err { grid-column:1 / -1; font-size:12px; color:var(--bad); }
  .sub-row .right { text-align:right; display:flex; flex-direction:column; gap:4px; align-items:flex-end; }
  .sub-row .elig { font-size:11px; color:var(--faint); }
  #overlay { position:fixed; inset:0; background:rgba(8,3,4,.86); display:none; align-items:center; justify-content:center; padding:16px; z-index:10; }
  #overlay .box { width:100%; max-width:460px; background:var(--panel2); border:1px solid var(--accent); padding:22px; }
  #overlay .big { font-family:var(--serif); font-size:24px; margin:4px 0 14px; }
  #overlay dl { margin:0 0 16px; font-size:14px; }
  #overlay dt { color:var(--faint); font-size:11px; letter-spacing:2px; text-transform:uppercase; margin-top:8px; }
  #overlay dd { margin:2px 0 0; word-break:break-word; }
  .progress { margin:-12px 0 24px; font-size:14px; color:var(--muted); min-height:20px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="crumbs"><b>ROUGE</b> / ADMIN / INVITATIONS</div>
    <div class="who" id="who"></div>
  </header>

  <div class="campaign">
    <span class="label">Campaign</span>
    <h1 id="campaignName">Loading…</h1>
    <span id="campaignStatus"></span>
    <select id="campaignSelect" hidden aria-label="Choose campaign"></select>
  </div>

  <div id="notices"></div>

  <div class="metrics" id="metrics"></div>

  <div class="steps">
    <section class="step" id="step1">
      <h2>1 · PREVIEW</h2>
      <p>See exactly what subscribers will receive.</p>
      <button id="previewBtn">Preview email</button>
    </section>
    <section class="step" id="step2">
      <h2>2 · TEST</h2>
      <p id="testInfo">Send one copy to yourself and check it on your phone.</p>
      <div class="row">
        <select id="testTo" aria-label="Test recipient"></select>
        <button id="testBtn">Send test</button>
      </div>
      <div class="msg" id="testMsg" role="status"></div>
    </section>
    <section class="step" id="step3">
      <h2>3 · APPROVE</h2>
      <div id="approveBody"></div>
      <div class="msg" id="approveMsg" role="status"></div>
    </section>
    <section class="step" id="step4">
      <h2>4 · SEND</h2>
      <p id="sendInfo"></p>
      <div class="row">
        <button class="primary" id="sendBtn">Send invitations</button>
        <button id="resumeBtn" hidden>Resume sending</button>
        <button id="retryBtn">Retry failed</button>
      </div>
      <div class="msg" id="sendMsg" role="status"></div>
    </section>
  </div>

  <div class="progress" id="progress" role="status" aria-live="polite"></div>

  <section id="previewPanel" aria-label="Email preview">
    <div class="bar">
      <div class="row seg" id="previewModes">
        <button data-name="Dev" data-format="html" aria-pressed="true">With name</button>
        <button data-name="" data-format="html" aria-pressed="false">No name</button>
        <button data-name="Dev" data-format="text" aria-pressed="false">Plain text</button>
      </div>
      <button id="closePreview">Close</button>
    </div>
    <div id="previewBody"></div>
  </section>

  <h3>Subscribers</h3>
  <div class="list" id="list"></div>
</div>

<div id="overlay" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
  <div class="box">
    <div class="label" id="confirmTitle">Confirm</div>
    <div class="big" id="confirmBig"></div>
    <dl id="confirmDetails"></dl>
    <label class="check"><input type="checkbox" id="confirmCheck"><span id="confirmCheckText"></span></label>
    <div class="row">
      <button class="primary" id="confirmGo" disabled></button>
      <button id="confirmCancel">Cancel</button>
    </div>
  </div>
</div>

<script nonce="__NONCE__">
(function () {
  "use strict"
  var state = null
  var busy = false
  var campaignSlug = null
  var previewMode = { name: "Dev", format: "html" }
  var pendingAction = null
  var $ = function (id) { return document.getElementById(id) }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    })
  }
  function when(s) {
    if (!s) return ""
    var d = new Date(s.replace(" ", "T") + "Z")
    return isNaN(d) ? s : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s") }

  async function api(path, body) {
    var opts = { credentials: "same-origin", headers: {} }
    if (body) {
      opts.method = "POST"
      opts.headers["Content-Type"] = "application/json"
      opts.headers["X-Rouge-Admin"] = "1"
      opts.body = JSON.stringify(body)
    }
    var res
    try { res = await fetch("/admin/api/" + path, opts) }
    catch (e) { throw new Error("Network problem. Check your connection and refresh.") }
    if (res.status === 403 && !(res.headers.get("Content-Type") || "").includes("json")) {
      throw new Error("Your admin login has expired. Reload the page to sign in again.")
    }
    var data = {}
    try { data = await res.json() } catch (e) {}
    if (!res.ok) throw new Error(data.error || ("Request failed (" + res.status + ")"))
    return data
  }

  async function load() {
    var q = campaignSlug ? "?campaign=" + encodeURIComponent(campaignSlug) : ""
    state = await api("state" + q)
    campaignSlug = state.campaign.slug
    render()
  }

  function statusPill(sub) {
    if (!sub.eligible && !sub.status) return '<span class="pill">' + esc(sub.reason || "Not eligible") + "</span>"
    switch (sub.status) {
      case null: return '<span class="pill">Not sent</span>'
      case "pending": return '<span class="pill warn">Queued</span>'
      case "sending": return '<span class="pill warn">Sending…</span>'
      case "stuck": return '<span class="pill bad">Interrupted</span>'
      case "accepted": return '<span class="pill ok" title="Resend accepted it; waiting for delivery confirmation">Accepted</span>'
      case "delivered": return '<span class="pill ok">Delivered</span>'
      case "bounced": return '<span class="pill bad">Bounced</span>'
      case "complained": return '<span class="pill bad">Marked spam</span>'
      case "failed": return '<span class="pill bad">Failed</span>'
      default: return '<span class="pill">' + esc(sub.status) + "</span>"
    }
  }

  function render() {
    var c = state.campaign, m = state.metrics
    $("who").textContent = "Signed in as " + state.admin
    $("campaignName").textContent = c.name
    var statusClass = c.status === "complete" ? "ok" : c.status === "sending" ? "live" : c.status === "test_approved" ? "ok" : ""
    var statusText = { draft: "Draft", test_approved: "Test approved", sending: "Sending", complete: "Sent" }[c.status] || c.status
    $("campaignStatus").innerHTML = '<span class="pill ' + statusClass + '">' + esc(statusText) + "</span>"

    var sel = $("campaignSelect")
    if (state.campaigns.length > 1) {
      sel.hidden = false
      sel.innerHTML = state.campaigns.map(function (x) {
        return '<option value="' + esc(x.slug) + '"' + (x.slug === c.slug ? " selected" : "") + ">" + esc(x.name) + "</option>"
      }).join("")
    }

    var notices = ""
    if (state.missingConfig.length) {
      notices += '<div class="notice bad">Missing Cloudflare settings: ' + esc(state.missingConfig.join(", ")) + ". Sending stays off until these are set.</div>"
    }
    if (!c.hasTemplate) notices += '<div class="notice bad">No email template exists for this campaign yet.</div>'
    if (m.queued > 0 && !busy) notices += '<div class="notice">' + plural(m.queued, "email") + " still queued from an earlier send. Use Resume sending.</div>"
    $("notices").innerHTML = notices

    var metric = function (label, n, sub) {
      return '<div class="metric"><div class="label">' + label + '</div><div class="n">' + n + '</div><div class="sub">' + (sub || "") + "</div></div>"
    }
    $("metrics").innerHTML =
      metric("Eligible", m.eligible, "consented, subscribed") +
      metric("Emails sent", m.sent, m.delivered ? m.delivered + " confirmed delivered" : "accepted by Resend") +
      metric("Pending", m.pending, "not sent yet") +
      metric("Failed", m.failed + m.bounced, m.bounced ? m.bounced + " bounced / spam" : "") +
      metric("Unsubscribed", m.unsubscribed, "")

    var tested = !!c.testSentAt, approved = !!c.testApprovedAt
    $("step2").classList.toggle("done", tested)
    $("step3").classList.toggle("done", approved)
    $("testInfo").textContent = tested
      ? "Last test accepted by Resend " + when(c.testSentAt) + ". Send another any time."
      : "Send one copy to yourself and check it on your phone."
    $("testTo").innerHTML = state.testRecipients.map(function (e) {
      return '<option value="' + esc(e) + '"' + (e === state.admin ? " selected" : "") + ">" + esc(e) + "</option>"
    }).join("")

    if (approved) {
      $("approveBody").innerHTML = "<p>Test approved " + esc(when(c.testApprovedAt)) + ". Live sending is unlocked.</p>"
    } else if (!tested) {
      $("approveBody").innerHTML = "<p>Send a test first. Live sending stays locked until you approve it.</p>"
    } else {
      $("approveBody").innerHTML =
        '<label class="check"><input type="checkbox" id="approveCheck"><span>I opened the test email and checked the greeting, the code, the ticket button and the unsubscribe link.</span></label>' +
        '<button id="approveBtn" disabled>Approve test</button>'
      $("approveCheck").addEventListener("change", function (e) { $("approveBtn").disabled = !e.target.checked || busy })
      $("approveBtn").addEventListener("click", approve)
    }

    var sendable = approved && c.hasTemplate && !state.missingConfig.length
    $("sendInfo").textContent = !approved
      ? "Locked until the test is approved."
      : m.toSend > 0
        ? plural(m.toSend, "eligible subscriber") + " haven’t been sent this invitation yet."
        : "Everyone eligible has been sent this invitation."
    $("sendBtn").disabled = busy || !sendable || m.toSend === 0
    $("resumeBtn").hidden = !(m.queued > 0)
    $("resumeBtn").disabled = busy || !sendable
    $("retryBtn").disabled = busy || !sendable || m.retryable === 0
    $("retryBtn").textContent = m.retryable ? "Retry failed (" + m.retryable + ")" : "Retry failed"
    $("testBtn").disabled = busy || !c.hasTemplate || state.missingConfig.some(function (k) { return k !== "RESEND_WEBHOOK_SECRET" })

    $("list").innerHTML = state.subscribers.map(function (s) {
      return '<div class="sub-row"><div><div class="name">' + (s.firstName ? esc(s.firstName) : '<span style="color:var(--faint)">(no name)</span>') +
        '</div><div class="email">' + esc(s.email) + '</div></div><div class="right">' + statusPill(s) +
        '<span class="elig">' + (s.eligible ? "eligible" : esc(s.reason || "not eligible")) + "</span></div>" +
        (s.error && s.status !== "accepted" && s.status !== "delivered" ? '<div class="err">' + esc(s.error) + "</div>" : "") + "</div>"
    }).join("")
  }

  function setBusy(v) { busy = v; if (state) render() }
  function showMsg(id, text, ok) { var el = $(id); el.textContent = text; el.className = "msg " + (ok ? "ok" : "bad") }

  // ----- preview -----
  function showPreview() {
    $("previewPanel").style.display = "block"
    var url = "/admin/api/preview?campaign=" + encodeURIComponent(campaignSlug) + "&name=" + encodeURIComponent(previewMode.name)
    if (previewMode.format === "text") {
      $("previewBody").innerHTML = "<pre>Loading…</pre>"
      fetch(url + "&format=text", { credentials: "same-origin" }).then(function (r) { return r.text() }).then(function (t) {
        $("previewBody").firstChild.textContent = t
      })
    } else {
      $("previewBody").innerHTML = '<iframe sandbox title="Email preview" src="' + esc(url) + '"></iframe>'
    }
    Array.prototype.forEach.call(document.querySelectorAll("#previewModes button"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.name === previewMode.name && b.dataset.format === previewMode.format))
    })
    $("previewPanel").scrollIntoView({ behavior: "smooth", block: "start" })
  }
  $("previewBtn").addEventListener("click", showPreview)
  $("closePreview").addEventListener("click", function () { $("previewPanel").style.display = "none" })
  Array.prototype.forEach.call(document.querySelectorAll("#previewModes button"), function (b) {
    b.addEventListener("click", function () { previewMode = { name: b.dataset.name, format: b.dataset.format }; showPreview() })
  })

  // ----- test -----
  $("testBtn").addEventListener("click", async function () {
    setBusy(true); showMsg("testMsg", "Sending test…", true)
    try {
      var r = await api("test", { campaign: campaignSlug, to: $("testTo").value })
      showMsg("testMsg", "Accepted by Resend for " + r.to + ". That means Resend took it, not that it has arrived. Check your inbox (and spam).", true)
    } catch (e) { showMsg("testMsg", e.message, false) }
    setBusy(false); load().catch(fail)
  })

  // ----- approve -----
  async function approve() {
    setBusy(true)
    try { await api("approve", { campaign: campaignSlug, confirm: true }) }
    catch (e) { showMsg("approveMsg", e.message, false) }
    setBusy(false); load().catch(fail)
  }

  // ----- confirm dialog -----
  function openConfirm(opts) {
    pendingAction = opts.run
    $("confirmBig").textContent = opts.title
    $("confirmDetails").innerHTML = opts.details.map(function (d) { return "<dt>" + esc(d[0]) + "</dt><dd>" + esc(d[1]) + "</dd>" }).join("")
    $("confirmCheckText").textContent = opts.check
    $("confirmGo").textContent = opts.button
    $("confirmCheck").checked = false
    $("confirmGo").disabled = true
    $("overlay").style.display = "flex"
    $("confirmCheck").focus()
  }
  function closeConfirm() { $("overlay").style.display = "none"; pendingAction = null }
  $("confirmCheck").addEventListener("change", function (e) { $("confirmGo").disabled = !e.target.checked })
  $("confirmCancel").addEventListener("click", closeConfirm)
  $("confirmGo").addEventListener("click", function () {
    var run = pendingAction
    $("confirmGo").disabled = true
    closeConfirm()
    if (run) run()
  })
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && pendingAction) closeConfirm() })

  // ----- send -----
  $("sendBtn").addEventListener("click", function () {
    var n = state.metrics.toSend
    openConfirm({
      title: "Send to " + n + (n === 1 ? " person" : " people") + "?",
      details: [["Campaign", state.campaign.name], ["Recipients", plural(n, "eligible subscriber")], ["Subject", state.campaign.subject]],
      check: "I’ve approved the test and want to send this invitation now. This can’t be undone.",
      button: "Send to " + n + " now",
      run: function () { runSend("live", n) },
    })
  })
  $("retryBtn").addEventListener("click", function () {
    var n = state.metrics.retryable
    openConfirm({
      title: "Retry " + plural(n, "failed email") + "?",
      details: [["Campaign", state.campaign.name], ["Will retry", plural(n, "email")], ["Not affected", "Anyone already sent or bounced"]],
      check: "Retry only the failed emails. People who already received it won’t get a second copy.",
      button: "Retry " + n + " now",
      run: function () { runSend("retry", n) },
    })
  })
  $("resumeBtn").addEventListener("click", function () { runSend("continue") })

  async function runSend(mode, expected) {
    if (busy) return
    setBusy(true)
    var total = { accepted: 0, failed: 0 }
    var body = { campaign: campaignSlug, mode: mode, expected: expected }
    $("progress").textContent = "Sending… keep this page open."
    try {
      for (var round = 0; round < 60; round++) {
        var r = await api("send", body)
        body = { campaign: campaignSlug, mode: "continue" }
        total.accepted += r.accepted; total.failed += r.failed
        $("progress").textContent = "Accepted by Resend: " + total.accepted + " · Failed: " + total.failed + " · Left: " + r.remaining
        await load()
        if (r.remaining === 0) break
        if (r.rateLimited) await new Promise(function (ok) { setTimeout(ok, 3000) })
      }
      showMsg("sendMsg", "Done. " + plural(total.accepted, "email") + " accepted by Resend" +
        (total.failed ? ", " + total.failed + " failed (see list; use Retry failed)." : ".") +
        " Delivery confirmations appear as they arrive.", total.failed === 0)
      $("progress").textContent = ""
    } catch (e) {
      showMsg("sendMsg", e.message, false)
      $("progress").textContent = "Stopped. Nothing is sent twice: refresh, then use Resume sending or Retry failed."
    }
    setBusy(false)
    load().catch(fail)
  }

  $("campaignSelect").addEventListener("change", function (e) { campaignSlug = e.target.value; load().catch(fail) })

  function fail(e) { $("notices").innerHTML = '<div class="notice bad">' + esc(e.message) + "</div>" }
  window.addEventListener("beforeunload", function (e) { if (busy) { e.preventDefault(); e.returnValue = "" } })
  load().catch(fail)
})()
</script>
</body>
</html>`
