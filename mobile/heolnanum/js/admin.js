/* 관리자 페이지: 도움 요청 검수(승인/반려) + 혈액 보유량 입력
   화면을 숨기는 건 편의일 뿐, 진짜 권한 검사는 DB의 RLS 정책(is_admin)이 한다 */
var gateEl = document.getElementById("admin-gate");
var reviewEl = document.getElementById("review");
var stockSection = document.getElementById("stock");
var pendingEl = document.getElementById("pending-list");
var doneEl = document.getElementById("done-list");
var stockForm = document.getElementById("stock-form");
var stockMsg = document.getElementById("st-msg");
var TYPES = ["A", "B", "O", "AB"];
var allRequests = [];

var STATUS_BADGE = { pending: "badge-wait", approved: "badge-ok", rejected: "badge-no" };

function requestRowHtml(r, buttons) {
  return '<li><div class="grow"><strong>' + escapeHtml(r.alias) + "</strong> · " + escapeHtml(r.region) + " · " +
    escapeHtml(r.reason) + " · " + r.need + "장" + (r.urgent ? ' <span class="badge badge-urgent">긴급</span>' : "") +
    '<div class="sub">' + escapeHtml(r.posted) + " 접수" + (r.status === "approved" ? " · " + Math.min(r.got, r.need) + "/" + r.need + "장 모임" : "") + "</div>" +
    (r.story ? '<div class="admin-story">' + escapeHtml(r.story) + "</div>" : "") + "</div>" +
    '<span class="badge ' + STATUS_BADGE[r.status] + '">' + REQUEST_STATUS[r.status] + "</span>" + buttons + "</li>";
}
function statusBtn(id, status, label, outline) {
  return '<button type="button" class="btn btn-small' + (outline ? " btn-outline" : "") + '" data-id="' + id + '" data-status="' + status + '">' + label + "</button>";
}

function renderRequests() {
  var pending = allRequests.filter(function (r) { return r.status === "pending"; });
  var done = allRequests.filter(function (r) { return r.status !== "pending"; });
  pendingEl.innerHTML = pending.length ? pending.map(function (r) {
    return requestRowHtml(r, statusBtn(r.id, "approved", "승인") + statusBtn(r.id, "rejected", "반려", true));
  }).join("") : '<li class="empty" style="display:block">검수할 요청이 없어요.</li>';
  doneEl.innerHTML = done.length ? done.map(function (r) {
    return requestRowHtml(r, r.status === "approved"
      ? statusBtn(r.id, "rejected", "공개 중지", true)
      : statusBtn(r.id, "approved", "다시 승인", true));
  }).join("") : '<li class="empty" style="display:block">아직 처리한 요청이 없어요.</li>';
}

function onStatusClick(e) {
  var btn = e.target.closest("[data-status]");
  if (!btn) return;
  var id = btn.getAttribute("data-id");
  var status = btn.getAttribute("data-status");
  btn.disabled = true;
  dbSetRequestStatus(id, status).then(function (updated) {
    allRequests = allRequests.map(function (r) {
      if (r.id !== id) return r;
      updated.got = r.got;
      return updated;
    });
    renderRequests();
    showToast(status === "approved" ? "승인했어요. 기부 요청 목록에 공개됐어요." : "반려했어요. 목록에서 내려갔어요.");
  }).catch(function (err) {
    btn.disabled = false;
    showToast(dbErrorText(err));
  });
}
pendingEl.addEventListener("click", onStatusClick);
doneEl.addEventListener("click", onStatusClick);

function fillStockForm(stock) {
  document.getElementById("st-date").value = toDateStr(today());
  if (!stock) return;
  stock.items.forEach(function (it) { document.getElementById("st-" + it.type).value = it.days.toFixed(1); });
  stockMsg.className = "form-msg";
  stockMsg.textContent = "지금 사이트에 보이는 값: " + stock.baseDate + " 기준";
}

stockForm.addEventListener("submit", function (e) {
  e.preventDefault();
  var data = { baseDate: document.getElementById("st-date").value };
  stockMsg.className = "form-msg error";
  if (!data.baseDate) { stockMsg.textContent = "기준일을 선택해 주세요."; return; }
  for (var i = 0; i < TYPES.length; i++) {
    var raw = document.getElementById("st-" + TYPES[i]).value;
    var v = Math.round(parseFloat(raw) * 10) / 10;
    if (raw === "" || !(v >= 0 && v <= 99)) { stockMsg.textContent = TYPES[i] + "형 보유일수를 0~99 사이 숫자로 입력해 주세요."; return; }
    data[TYPES[i]] = v;
  }
  var btn = stockForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  dbSaveStock(data).then(function (saved) {
    stockMsg.className = "form-msg";
    stockMsg.textContent = saved.baseDate + " 기준 보유량을 저장했어요. 홈과 혈액 현황에 바로 반영돼요.";
  }).catch(function (err) {
    stockMsg.textContent = dbErrorText(err);
  }).then(function () {
    btn.disabled = false;
  });
});

function initAdmin() {
  reviewEl.hidden = true;
  stockSection.hidden = true;
  gateEl.innerHTML = "";
  var unavailable = authUnavailableMessage();
  if (unavailable) { gateEl.innerHTML = noticeHtml(unavailable); return; }

  currentUser().then(function (user) {
    if (!user) { gateEl.innerHTML = loginNoticeHtml("관리 페이지를 보려면"); return; }
    return dbIsAdmin().then(function (isAdmin) {
      if (!isAdmin) {
        gateEl.innerHTML = noticeHtml("관리자만 들어올 수 있어요. 관리자 지정 방법은 supabase/schema.sql 맨 아래에 있어요.");
        return;
      }
      pendingEl.innerHTML = '<li class="empty" style="display:block">불러오는 중…</li>';
      reviewEl.hidden = false;
      stockSection.hidden = false;
      return Promise.all([dbAdminListRequests(), dbLatestStock()]).then(function (res) {
        allRequests = res[0];
        renderRequests();
        fillStockForm(res[1]);
      });
    });
  }).catch(function (err) {
    gateEl.innerHTML = noticeHtml(dbErrorText(err));
  });
}

document.addEventListener("hn:signout", initAdmin);
initAdmin();
