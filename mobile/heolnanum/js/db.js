/* Supabase DB 읽기/쓰기 함수 모음 (auth.js 다음에 로드)
   · 화면 코드가 쓰는 객체 모양({id, date, type, place} 등)으로 바꿔서 돌려준다
   · 테이블 정의와 RLS 정책은 supabase/schema.sql — 여기서는 user_id 를 보내지 않는다 (DB가 로그인 사용자로 채움) */

/* 로그인한 사용자를 돌려줌 (비로그인이거나 연결 설정이 없으면 null) */
function currentUser() {
  if (!hnClient) return Promise.resolve(null);
  return hnClient.auth.getSession().then(function (res) {
    return res.data.session ? res.data.session.user : null;
  });
}

function unwrap(res) {
  if (res.error) throw res.error;
  return res.data;
}

function dbErrorText(err) {
  var code = (err && err.code) || "";
  var msg = (err && err.message) || "";
  if (code === "P0001" && msg) return msg;   /* DB 트리거가 보낸 안내 문구 (예: 남은 장수 초과) */
  if (code === "PGRST205" || code === "PGRST202" || code === "42P01" || code === "42883") return "DB가 최신이 아니에요. supabase/schema.sql 을 SQL Editor 에서 다시 실행해 주세요.";
  if (code === "PGRST301" || /jwt/i.test(msg)) return "로그인이 만료됐어요. 다시 로그인해 주세요.";
  if (code === "42501") return "권한이 없어요. 다시 로그인해 주세요.";
  if (code === "23514") return "입력한 값이 올바르지 않아요.";
  if (code === "PGRST116") return "찾을 수 없거나 권한이 없어요.";
  if (/fetch|network/i.test(msg)) return "서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.";
  /* 모르는 오류: 원인을 같이 보여줘야 고칠 수 있다 (개발자도구 콘솔에도 남긴다) */
  if (window.console) console.error("[헌혈나눔]", err);
  return "문제가 생겼어요. 잠시 후 다시 시도해 주세요." + (msg ? " (원인: " + (code ? code + " " : "") + msg + ")" : "");
}

/* 안내 상자 / 로그인 유도 (텍스트는 escape 해서 넣는다) */
function noticeHtml(text) {
  return '<div class="notice">' + escapeHtml(text) + "</div>";
}
/* 로그인 뒤 지금 보던 페이지로 돌아오게 하는 로그인 주소 (login.js 가 next 를 읽는다) */
function loginHref() {
  return "login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search);
}
function loginNoticeHtml(what) {
  return '<div class="notice"><strong>로그인이 필요해요</strong> · ' + escapeHtml(what) +
    ' <a href="' + loginHref() + '">로그인</a> 또는 <a href="signup.html">회원가입</a>을 해 주세요.</div>';
}

/* 지금 로그인한 사람이 관리자인지 (관리자 지정은 schema.sql 맨 아래) */
function dbIsAdmin() {
  if (!hnClient) return Promise.resolve(false);
  return hnClient.rpc("is_admin").then(unwrap).then(function (v) { return v === true; });
}

/* ── 헌혈 기록 ── */
var RECORD_COLS = "id, donated_on, type, place";
function toRecord(r) { return { id: r.id, date: r.donated_on, type: r.type, place: r.place }; }

function dbListRecords() {
  return hnClient.from("donation_records").select(RECORD_COLS).order("donated_on", { ascending: false })
    .then(unwrap).then(function (rows) { return rows.map(toRecord); });
}
function dbAddRecord(rec) {
  return hnClient.from("donation_records").insert({ donated_on: rec.date, type: rec.type, place: rec.place })
    .select(RECORD_COLS).single().then(unwrap).then(toRecord);
}
function dbDeleteRecord(id) {
  return hnClient.from("donation_records").delete().eq("id", id).then(unwrap);
}

/* ── 도움 요청 (= 승인되면 기부 요청 목록에 공개) ──
   got: 모든 회원의 기부 약속 합계 (pledge_totals 함수 — 누가 얼마나 했는지는 숨기고 합계만) */
var REQUEST_COLS = "id, user_id, alias, region, reason, need, story, urgent, status, created_at";
var REQUEST_STATUS = { pending: "검수 대기", approved: "공개 중", rejected: "반려" };
function toRequest(r) {
  return {
    id: r.id, userId: r.user_id, alias: r.alias, region: r.region, reason: r.reason, need: r.need, story: r.story,
    urgent: r.urgent, status: r.status, posted: toDateStr(new Date(r.created_at)), got: 0
  };
}
function dbPledgeTotals() {
  return hnClient.rpc("pledge_totals").then(unwrap).then(function (rows) {
    var map = {};
    rows.forEach(function (t) { map[t.help_request_id] = t.total; });
    return map;
  });
}
function requestsWithTotals(query) {
  return Promise.all([query.then(unwrap), dbPledgeTotals()]).then(function (res) {
    return res[0].map(function (row) {
      var req = toRequest(row);
      req.got = res[1][req.id] || 0;
      return req;
    });
  });
}

/* 공개된 기부 요청 (로그인 없이도 읽힌다) — 최신순 */
function dbListOpenRequests() {
  return requestsWithTotals(hnClient.from("help_requests").select(REQUEST_COLS)
    .eq("status", "approved").order("created_at", { ascending: false }));
}
/* 내가 접수한 요청 (상태와 상관없이) — 오래된 것부터 */
function dbListMyRequests(userId) {
  return requestsWithTotals(hnClient.from("help_requests").select(REQUEST_COLS)
    .eq("user_id", userId).order("created_at", { ascending: true }));
}
function dbAddRequest(r) {
  return hnClient.from("help_requests")
    .insert({ alias: r.alias, region: r.region, reason: r.reason, need: r.need, story: r.story, urgent: r.urgent })
    .select(REQUEST_COLS).single().then(unwrap).then(toRequest);
}
function dbDeleteRequest(id) {
  return hnClient.from("help_requests").delete().eq("id", id).then(unwrap);
}
/* 관리자: 모든 요청 (최신순) / 승인·반려 */
function dbAdminListRequests() {
  return requestsWithTotals(hnClient.from("help_requests").select(REQUEST_COLS).order("created_at", { ascending: false }));
}
function dbSetRequestStatus(id, status) {
  return hnClient.from("help_requests").update({ status: status }).eq("id", id)
    .select(REQUEST_COLS).single().then(unwrap).then(toRequest);
}

/* ── 기부 약속 (내 약속만 보인다. 오래된 것부터: 화면에서 뒤집어 최신순으로 보여줌) ── */
var PLEDGE_COLS = "id, help_request_id, amount, nickname, message, created_at";
function toPledge(r) {
  return { id: r.id, reqId: r.help_request_id, count: r.amount, nick: r.nickname, msg: r.message, at: toDateStr(new Date(r.created_at)) };
}

function dbListPledges() {
  /* help_request_id 가 없는 행 = 예전 버전에서 남은 약속 → 보여주지 않는다 */
  return hnClient.from("pledges").select(PLEDGE_COLS).not("help_request_id", "is", null).order("created_at", { ascending: true })
    .then(unwrap).then(function (rows) { return rows.map(toPledge); });
}
function dbAddPledge(p) {
  return hnClient.from("pledges").insert({ help_request_id: p.reqId, amount: p.count, nickname: p.nick, message: p.msg })
    .select(PLEDGE_COLS).single().then(unwrap).then(toPledge);
}
function dbDeletePledge(id) {
  return hnClient.from("pledges").delete().eq("id", id).then(unwrap);
}

/* ── 혈액 보유량 (관리자가 기준일별로 입력, 누구나 읽기) ── */
function toStock(r) {
  if (!r) return null;
  return {
    baseDate: r.base_date,
    items: [
      { type: "A", days: Number(r.a_days) }, { type: "B", days: Number(r.b_days) },
      { type: "O", days: Number(r.o_days) }, { type: "AB", days: Number(r.ab_days) }
    ]
  };
}
function dbLatestStock() {
  return hnClient.from("blood_stock").select("base_date, a_days, b_days, o_days, ab_days")
    .order("base_date", { ascending: false }).limit(1).maybeSingle().then(unwrap).then(toStock);
}
function dbSaveStock(s) {
  return hnClient.from("blood_stock")
    .upsert({ base_date: s.baseDate, a_days: s.A, b_days: s.B, o_days: s.O, ab_days: s.AB, updated_at: new Date().toISOString() }, { onConflict: "base_date" })
    .select("base_date, a_days, b_days, o_days, ab_days").single().then(unwrap).then(toStock);
}

/* ── 게시판 (읽기는 로그인 없이도 가능. 작성자 이름은 DB가 채운다 → schema.sql 의 posts) ── */
var POST_CATEGORIES = [["review", "헌혈 후기"], ["question", "질문"], ["free", "자유"]];
function categoryLabel(key) {
  var found = POST_CATEGORIES.filter(function (c) { return c[0] === key; })[0];
  return found ? found[1] : "";
}

var POST_COLS = "id, user_id, author_name, category, title, content, created_at, updated_at";
/* 목록에는 본문 대신 댓글 수만 받는다 */
var POST_LIST_COLS = "id, user_id, author_name, category, title, created_at, updated_at, comments(count)";
function toPost(r) {
  return {
    id: r.id, userId: r.user_id, author: r.author_name, category: r.category, title: r.title,
    content: r.content, createdAt: r.created_at, updatedAt: r.updated_at,
    commentCount: r.comments && r.comments[0] ? r.comments[0].count : 0
  };
}

/* opt: { category, q, page, size } → { posts, total } */
function dbListPosts(opt) {
  var from = (opt.page - 1) * opt.size;
  var query = hnClient.from("posts").select(POST_LIST_COLS, { count: "exact" });
  if (opt.category) query = query.eq("category", opt.category);
  /* 검색어가 필터 문법(쉼표·괄호·따옴표·와일드카드)을 깨지 못하도록 공백으로 바꾼다 */
  var q = opt.q.replace(/[,()"\\%*_]/g, " ").trim();
  if (q) query = query.or("title.ilike.*" + q + "*,content.ilike.*" + q + "*");
  return query.order("created_at", { ascending: false }).range(from, from + opt.size - 1).then(function (res) {
    if (res.error) throw res.error;
    return { posts: res.data.map(toPost), total: res.count || 0 };
  });
}
function dbGetPost(id) {
  return hnClient.from("posts").select(POST_COLS).eq("id", id).maybeSingle().then(function (res) {
    if (res.error && res.error.code === "22P02") return null;   /* uuid 모양이 아닌 id = 없는 글 */
    return unwrap(res);
  }).then(function (r) { return r ? toPost(r) : null; });
}
function dbAddPost(p) {
  return hnClient.from("posts").insert({ category: p.category, title: p.title, content: p.content })
    .select(POST_COLS).single().then(unwrap).then(toPost);
}
function dbUpdatePost(id, p) {
  return hnClient.from("posts").update({ category: p.category, title: p.title, content: p.content })
    .eq("id", id).select(POST_COLS).single().then(unwrap).then(toPost);
}
function dbDeletePost(id) {
  return hnClient.from("posts").delete().eq("id", id).select("id").then(unwrap).then(function (rows) {
    if (!rows.length) throw { code: "PGRST116" };   /* 지울 권한이 없으면 아무것도 지워지지 않는다 */
  });
}

/* ── 댓글 (읽기 누구나 / 쓰기 회원 / 수정 쓴 사람 / 삭제 쓴 사람·관리자) ── */
var COMMENT_COLS = "id, post_id, user_id, author_name, content, created_at, updated_at";
function toComment(r) {
  return { id: r.id, postId: r.post_id, userId: r.user_id, author: r.author_name, content: r.content, createdAt: r.created_at, updatedAt: r.updated_at };
}
function dbListComments(postId) {
  return hnClient.from("comments").select(COMMENT_COLS).eq("post_id", postId).order("created_at", { ascending: true })
    .then(unwrap).then(function (rows) { return rows.map(toComment); });
}
function dbAddComment(postId, content) {
  return hnClient.from("comments").insert({ post_id: postId, content: content })
    .select(COMMENT_COLS).single().then(unwrap).then(toComment);
}
function dbUpdateComment(id, content) {
  /* 남의 댓글이면 아무 행도 안 바뀌어서 single() 이 PGRST116 을 낸다 */
  return hnClient.from("comments").update({ content: content }).eq("id", id)
    .select(COMMENT_COLS).single().then(unwrap).then(toComment);
}
function dbDeleteComment(id) {
  return hnClient.from("comments").delete().eq("id", id).select("id").then(unwrap).then(function (rows) {
    if (!rows.length) throw { code: "PGRST116" };
  });
}
