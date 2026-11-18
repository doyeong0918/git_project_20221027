/* 여러 페이지가 함께 쓰는 화면 부품: 기부 요청 카드, 혈액 보유 대시보드 (common.js 다음에 로드)
   → 데이터는 모두 Supabase DB에서 온다 (db.js) */
var MYTYPE_KEY = "hn_mytype";
var GAUGE_MAX_DAYS = 7;

/* 혈액관리본부 혈액수급 위기단계: 5일분 미만 관심 · 3일분 미만 주의 · 2일분 미만 경계 · 1일분 미만 심각 */
function levelOf(days) {
  if (days >= 5) return { n: 1, label: "적정" };
  if (days >= 3) return { n: 2, label: "관심" };
  if (days >= 2) return { n: 3, label: "주의" };
  if (days >= 1) return { n: 4, label: "경계" };
  return { n: 5, label: "심각" };
}

/* ── 기부 요청 카드 ──
   req: db.js 의 toRequest 모양 ({ id, userId, alias, region, reason, need, story, urgent, posted, got })
   mode: "donate" = 기부 버튼(매칭 페이지), "link" = 매칭 페이지로 가는 링크(홈)
   myId: 로그인한 사용자 id — 내 요청에는 기부 버튼 대신 "내 요청" 표시 */
function requestCardHtml(req, mode, myId) {
  var got = Math.min(req.got, req.need);
  var remain = req.need - got;
  var pct = Math.round((got / req.need) * 100);
  var urgent = req.urgent ? '<span class="badge badge-urgent">긴급</span>' : '<span class="badge">일반</span>';
  var action;
  if (remain <= 0) action = '<button type="button" class="btn" disabled>목표 달성 🎉</button>';
  else if (mode === "link") action = '<a class="btn btn-outline" href="match.html#requests">자세히 보고 기부하기</a>';
  else if (myId && req.userId === myId) action = '<button type="button" class="btn btn-outline" disabled>내가 올린 요청</button>';
  else action = '<button type="button" class="btn" data-donate="' + req.id + '">헌혈증 기부하기</button>';
  return '<article class="req-card">' +
    '<div class="req-top">' + urgent + '<span class="badge">' + escapeHtml(req.region) + '</span>' +
    '<span class="req-date">' + escapeHtml(req.posted) + "</span></div>" +
    '<div class="req-title">' + escapeHtml(req.alias) + "</div>" +
    '<p class="req-desc">사유: ' + escapeHtml(req.reason) + "</p>" +
    (req.story ? '<p class="req-story">' + escapeHtml(req.story) + "</p>" : "") +
    '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + req.need + '" aria-valuenow="' + got + '">' +
    '<div class="progress-bar" style="width:' + pct + '%"></div></div>' +
    '<div class="progress-text"><span>' + got + " / " + req.need + "장</span><span>" +
    (remain > 0 ? remain + "장 남음" : "완료") + "</span></div>" + action + "</article>";
}

/* ── 혈액 보유 대시보드: 도넛(전체 평균) + 혈액형별 막대 ──
   stock: db.js 의 toStock 모양 ({ baseDate, items: [{ type, days }] }), 아직 입력된 값이 없으면 null */
function renderStockDash(el, stock) {
  if (!stock) {
    el.innerHTML = '<div class="empty" style="grid-column:1/-1">아직 등록된 혈액 보유량이 없어요. ' +
      '<a href="https://www.bloodinfo.net/knrcbs/bi/info/bldHoldSttus.do?mi=1046" target="_blank" rel="noopener">혈액관리본부 공식 현황</a>에서 확인해 주세요.</div>';
    return;
  }
  var mine = loadJson(MYTYPE_KEY, "");
  var items = stock.items;
  var avg = items.reduce(function (s, x) { return s + x.days; }, 0) / items.length;
  var avgLv = levelOf(avg);
  var C = 2 * Math.PI * 42;
  var arc = Math.min(1, avg / GAUGE_MAX_DAYS) * C;

  var donut = '<div class="donut-wrap"><svg class="donut" viewBox="0 0 100 100" role="img" aria-label="전체 평균 ' + avg.toFixed(1) + '일분, ' + avgLv.label + '">' +
    '<circle class="donut-bg" cx="50" cy="50" r="42"></circle>' +
    '<circle class="donut-fg s-' + avgLv.n + '" cx="50" cy="50" r="42" stroke-dasharray="' + arc.toFixed(1) + " " + C.toFixed(1) + '" transform="rotate(-90 50 50)"></circle>' +
    '<text class="donut-num" x="50" y="52" text-anchor="middle">' + avg.toFixed(1) + '</text>' +
    '<text class="donut-unit" x="50" y="64" text-anchor="middle">DAY</text></svg>' +
    '<div class="donut-caption">전체 평균 <strong>' + avg.toFixed(1) + '일분</strong> <span class="lv-pill lv-' + avgLv.n + '">' + avgLv.label + "</span></div>" +
    '<div class="stock-date">' + escapeHtml(stock.baseDate) + " 기준 · 출처: 대한적십자사 혈액관리본부</div></div>";

  var bars = '<div class="vbars">' + items.map(function (s) {
    var lv = levelOf(s.days);
    var pct = Math.min(100, Math.round((s.days / GAUGE_MAX_DAYS) * 100));
    return '<div class="vbar' + (s.type === mine ? " mine" : "") + '">' +
      '<div class="vbar-track" role="img" aria-label="' + s.type + "형 " + lv.label + " " + s.days.toFixed(1) + '일분">' +
      '<div class="vbar-fill lv-' + lv.n + '" style="height:' + pct + '%"></div></div>' +
      '<div class="vbar-type">' + s.type + '</div><div class="vbar-days">' + s.days.toFixed(1) + '일분</div>' +
      '<span class="lv-pill lv-' + lv.n + '">' + lv.label + "</span></div>";
  }).join("") + "</div>";

  el.innerHTML = donut + bars;
}
