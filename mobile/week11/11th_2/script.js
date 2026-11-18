"use strict"; // 엄격 모드로 작성하지 않은 변수 사용 같은 실수를 빠르게 찾습니다.

// 영화진흥위원회 KOBIS 오픈 API의 기본 주소입니다.
const kobisApiBaseUrl = "https://www.kobis.or.kr/kobisopenapi/webservice/rest"; // 박스오피스와 영화 정보를 요청할 주소입니다.

// 자주 사용하는 화면 요소를 한 번만 찾아 보관합니다.
const apiKeyForm = document.querySelector("#api-key-form"); // API 키 연결 양식입니다.
const apiKeyInput = document.querySelector("#api-key-input"); // 새 API 키를 입력하는 칸입니다.
const connectButton = document.querySelector("#connect-button"); // API 키 연결 중 비활성화할 버튼입니다.
const connectionStatus = document.querySelector("#connection-status"); // 현재 API 연결 상태입니다.
const pageMessage = document.querySelector("#page-message"); // 오류와 안내 문구를 표시하는 영역입니다.
const boxOfficeForm = document.querySelector("#box-office-form"); // 박스오피스 날짜와 종류 필터입니다.
const boxOfficeDateInput = document.querySelector("#box-office-date"); // 박스오피스 조회 기준일입니다.
const nationFilter = document.querySelector("#nation-filter"); // 한국 영화나 외국 영화 필터입니다.
const boxOfficeStatus = document.querySelector("#box-office-status"); // 박스오피스 조회 상태입니다.
const boxOfficeList = document.querySelector("#box-office-list"); // 박스오피스 결과 카드 목록입니다.
const movieSearchForm = document.querySelector("#movie-search-form"); // 영화 이름 검색 양식입니다.
const movieSearchInput = document.querySelector("#movie-search-input"); // 찾을 영화 이름을 입력하는 칸입니다.
const genreFilter = document.querySelector("#genre-filter"); // 검색 결과를 좁히는 장르 선택 메뉴입니다.
const movieSearchStatus = document.querySelector("#movie-search-status"); // 영화 검색 상태입니다.
const movieSearchResults = document.querySelector("#movie-search-results"); // 영화 검색 결과 카드 목록입니다.
const selectedMovieName = document.querySelector("#selected-movie-name"); // 시간표 안내에서 선택된 영화 이름입니다.
const movieDetailDialog = document.querySelector("#movie-detail-dialog"); // 영화 상세 정보를 보여주는 대화상자입니다.
const movieDetailContent = document.querySelector("#movie-detail-content"); // 영화 상세 정보를 넣을 영역입니다.
const closeDetailButton = document.querySelector("#close-detail-button"); // 영화 상세 대화상자를 닫는 버튼입니다.

// API 키와 요청 결과를 브라우저 메모리 안에서만 관리합니다.
let kobisApiKey = ""; // 사용자가 이 페이지에서 입력한 키이며 저장소에 기록하지 않습니다.
let boxOfficeRequestNumber = 0; // 빠른 날짜 변경에서 오래된 응답을 무시하기 위한 번호입니다.
let movieSearchRequestNumber = 0; // 빠른 영화 검색에서 오래된 응답을 무시하기 위한 번호입니다.
let lastMovieSearchResults = []; // 장르 필터를 다시 적용할 수 있도록 마지막 결과를 보관합니다.

// 날짜 입력창에 사용할 YYYY-MM-DD 형식의 날짜를 만듭니다.
function formatInputDate(date) {
  const year = date.getFullYear(); // 날짜의 연도를 가져옵니다.
  const month = String(date.getMonth() + 1).padStart(2, "0"); // 월을 두 자리 숫자로 맞춥니다.
  const day = String(date.getDate()).padStart(2, "0"); // 일을 두 자리 숫자로 맞춥니다.
  return `${year}-${month}-${day}`; // 날짜 입력창에 맞는 문자열을 돌려줍니다.
} // 날짜 문자열 함수를 마칩니다.

// KOBIS API 호출에 사용할 날짜와 영화 종류를 준비합니다.
function setDefaultSearchDate() {
  const yesterday = new Date(); // 오늘 날짜를 복사할 새 날짜 객체입니다.
  yesterday.setDate(yesterday.getDate() - 1); // 일별 박스오피스가 발표되는 전날을 기본으로 선택합니다.
  boxOfficeDateInput.value = formatInputDate(yesterday); // 날짜 입력창에 기본 기준일을 넣습니다.
} // 기본 날짜 설정 함수를 마칩니다.

// 화면의 공통 안내 영역에 메시지를 표시합니다.
function showPageMessage(message) {
  pageMessage.textContent = message; // 안내 문구를 안전한 일반 텍스트로 넣습니다.
  pageMessage.hidden = false; // 안내 영역을 화면에 표시합니다.
} // 공통 안내 함수를 마칩니다.

// 이전 공통 안내를 화면에서 감춥니다.
function clearPageMessage() {
  pageMessage.textContent = ""; // 이전 메시지를 지웁니다.
  pageMessage.hidden = true; // 빈 안내 영역을 감춥니다.
} // 공통 안내 초기화 함수를 마칩니다.

// 연결 상태 문구와 보조 기술용 상태 값을 함께 갱신합니다.
function setConnectionStatus(message, isConnected = false) {
  connectionStatus.textContent = message; // 현재 연결 상태를 화면에 표시합니다.
  connectionStatus.dataset.connected = String(isConnected); // 연결 성공 상태를 스타일과 보조 기술에 전달합니다.
} // 연결 상태 갱신 함수를 마칩니다.

// API 응답의 오류 내용에서 키를 포함하지 않는 메시지를 만듭니다.
function getReadableError(error) {
  if (error instanceof TypeError) { // 네트워크 또는 브라우저 접근 오류인지 확인합니다.
    return "API에 연결할 수 없습니다. 인터넷 연결이나 브라우저의 API 접근 상태를 확인해 주세요."; // 키 값을 노출하지 않고 해결 방법을 안내합니다.
  } // 네트워크 오류 처리를 마칩니다.
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."; // API가 돌려준 일반 오류를 사용자에게 알립니다.
} // 사용자용 오류 문구 함수를 마칩니다.

// KOBIS API에 요청하고 키 오류와 응답 오류를 확인합니다.
async function requestKobisApi(endpoint, parameters = {}) {
  if (!kobisApiKey) { // 요청 전에 사용자가 키를 입력했는지 확인합니다.
    throw new Error("먼저 KOBIS API 키를 입력해 주세요."); // 키가 없으면 요청을 진행하지 않습니다.
  } // API 키 확인을 마칩니다.
  const requestUrl = new URL(`${kobisApiBaseUrl}/${endpoint}`); // API 주소와 기능 경로로 URL 객체를 만듭니다.
  requestUrl.searchParams.set("key", kobisApiKey); // KOBIS가 요구하는 인증 키를 요청에 넣습니다.
  Object.entries(parameters).forEach(([name, value]) => { // 입력된 검색 조건을 하나씩 주소에 추가합니다.
    if (value !== undefined && value !== null && value !== "") { // 값이 있는 조건만 포함합니다.
      requestUrl.searchParams.set(name, String(value)); // URL 인코딩이 적용되도록 검색 조건을 설정합니다.
    } // 빈 조건을 제외합니다.
  }); // 모든 검색 조건을 주소에 추가합니다.
  const response = await fetch(requestUrl.toString(), { headers: { Accept: "application/json" } }); // KOBIS에서 JSON 자료를 요청합니다.
  if (!response.ok) { // HTTP 응답이 정상인지 확인합니다.
    throw new Error(`KOBIS API 요청에 실패했습니다. (HTTP ${response.status})`); // 서버 오류 상태를 분명하게 전달합니다.
  } // HTTP 응답 확인을 마칩니다.
  const responseData = await response.json(); // JSON 응답을 자바스크립트 자료로 변환합니다.
  if (responseData.faultInfo) { // KOBIS API 자체의 인증·요청 오류를 확인합니다.
    const apiMessage = String(responseData.faultInfo.message || ""); // KOBIS가 돌려준 오류 문구를 읽습니다.
    const apiErrorCode = String(responseData.faultInfo.errorCode || ""); // 오류 코드가 문자열·숫자 중 어떤 형태인지 관계없이 읽습니다.
    if (apiErrorCode === "320010" || apiMessage.trim().toLowerCase() === "invalidkey") { // 인증 키가 잘못된 대표 오류인지 확인합니다.
      throw new Error("KOBIS API 키가 유효하지 않습니다. 새 키를 발급받았는지 확인해 주세요."); // 키 오류를 이해하기 쉬운 안내로 바꿉니다.
    } // API 키 오류 번역을 마칩니다.
    throw new Error(apiMessage || "KOBIS API에서 요청을 처리하지 못했습니다."); // 다른 API 오류는 키를 제외한 내용만 전달합니다.
  } // API 오류 확인을 마칩니다.
  return responseData; // 검증한 KOBIS 응답을 반환합니다.
} // KOBIS 요청 함수를 마칩니다.

// API 조회 시각을 한국어 시간으로 표시합니다.
function getCurrentTimeLabel() {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date()); // 브라우저에서 조회한 시각을 표시합니다.
} // 조회 시각 함수를 마칩니다.

// YYYYMMDD 또는 YYYY-MM-DD 날짜를 읽기 쉬운 형식으로 표시합니다.
function formatDisplayDate(dateString) {
  if (!dateString) { // 날짜 정보가 없을 때를 확인합니다.
    return "정보 없음"; // 임의의 날짜를 만들지 않습니다.
  } // 날짜 없음 처리를 마칩니다.
  const normalizedDate = dateString.replaceAll("-", ""); // 날짜 구분 기호를 제거합니다.
  if (!/^\d{8}$/.test(normalizedDate)) { // 날짜가 8자리 숫자인지 확인합니다.
    return dateString; // 이미 다른 형식이면 전달받은 값을 그대로 표시합니다.
  } // 날짜 형식 확인을 마칩니다.
  return `${normalizedDate.slice(0, 4)}.${normalizedDate.slice(4, 6)}.${normalizedDate.slice(6, 8)}`; // 연·월·일 사이에 점을 넣어 표시합니다.
} // 날짜 표시 함수를 마칩니다.

// 숫자를 한국어 형식으로 표시하고 자료가 없으면 안내합니다.
function formatNumber(value) {
  if (value === undefined || value === null || value === "") { // API 값이 빠져 있는지 확인합니다.
    return "정보 없음"; // 없는 숫자를 0으로 오해하지 않게 합니다.
  } // 숫자 누락 확인을 마칩니다.
  const numericValue = Number(value); // API 문자열을 숫자로 변환합니다.
  return Number.isFinite(numericValue) ? new Intl.NumberFormat("ko-KR").format(numericValue) : "정보 없음"; // 유효한 수만 천 단위로 구분합니다.
} // 숫자 표시 함수를 마칩니다.

// 목록 영역에 안내 문구를 표시하고 기존 결과 카드를 지웁니다.
function showEmptyMessage(container, message) {
  container.replaceChildren(); // 이전 카드와 문구를 모두 지웁니다.
  const messageElement = document.createElement("p"); // 새 안내 문단을 만듭니다.
  messageElement.className = "empty-message"; // 비어 있는 상태 스타일을 적용합니다.
  messageElement.textContent = message; // 안내 문구를 일반 텍스트로 넣습니다.
  container.append(messageElement); // 안내 문구를 목록에 추가합니다.
} // 빈 목록 안내 함수를 마칩니다.

// 박스오피스 날짜와 영화 종류에 해당하는 KOBIS 순위를 조회합니다.
async function loadBoxOffice() {
  if (!kobisApiKey) { // API 키 입력 여부를 확인합니다.
    showPageMessage("영화 정보를 불러오려면 먼저 KOBIS API 키를 입력해 주세요."); // 키 입력을 요청합니다.
    return false; // 키가 없으면 API를 호출하지 않습니다.
  } // API 키 확인을 마칩니다.
  if (!boxOfficeDateInput.value) { // 조회할 날짜가 선택되어 있는지 확인합니다.
    showPageMessage("박스오피스 기준 날짜를 선택해 주세요."); // 날짜 선택을 안내합니다.
    return false; // 날짜 없는 요청을 보내지 않습니다.
  } // 기준 날짜 확인을 마칩니다.
  const thisRequestNumber = ++boxOfficeRequestNumber; // 이 요청의 순서를 기록합니다.
  const requestKey = kobisApiKey; // 요청 시작 시 사용한 키 버전을 기억합니다.
  const targetDate = boxOfficeDateInput.value.replaceAll("-", ""); // API가 요구하는 YYYYMMDD 형식으로 바꿉니다.
  const nationCode = nationFilter.value; // 전체, 한국 영화, 외국 영화 선택을 가져옵니다.
  boxOfficeStatus.textContent = "KOBIS 박스오피스를 불러오고 있습니다..."; // 조회 중 상태를 표시합니다.
  showEmptyMessage(boxOfficeList, "상영 순위를 요청하고 있습니다."); // 이전 결과가 남지 않게 하고 대기 문구를 표시합니다.
  const submitButton = boxOfficeForm.querySelector("button[type='submit']"); // 조회 버튼을 찾습니다.
  submitButton.disabled = true; // 같은 조건의 중복 요청을 막습니다.
  try { // 박스오피스 요청과 결과 표시를 수행합니다.
    const responseData = await requestKobisApi("boxoffice/searchDailyBoxOfficeList.json", { targetDt: targetDate, repNationCd: nationCode, itemPerPage: 10 }); // 일별 순위 최대 10개를 요청합니다.
    if (thisRequestNumber !== boxOfficeRequestNumber || requestKey !== kobisApiKey) { // 다른 검색이나 키 변경이 있었는지 확인합니다.
      return false; // 오래된 요청 결과를 화면에 표시하지 않습니다.
    } // 요청 순서와 키 확인을 마칩니다.
    const dailyBoxOffice = responseData.boxOfficeResult; // KOBIS 일별 박스오피스 항목을 가져옵니다.
    if (!dailyBoxOffice || !Array.isArray(dailyBoxOffice.dailyBoxOfficeList)) { // 응답이 예상 구조인지 검사합니다.
      throw new Error("박스오피스 응답에 순위 정보가 없습니다."); // 잘못된 응답을 정상 자료처럼 취급하지 않습니다.
    } // 응답 구조 검사를 마칩니다.
    renderBoxOffice(dailyBoxOffice.dailyBoxOfficeList); // 실제 순위 결과를 화면 카드로 표시합니다.
    boxOfficeStatus.textContent = `기준일 ${formatDisplayDate(dailyBoxOffice.showRange || targetDate)} · 이 화면 조회 시각 ${getCurrentTimeLabel()}`; // 자료 기준일과 브라우저 조회 시각을 구분해 표시합니다.
    setConnectionStatus("KOBIS API 연결됨", true); // 성공한 API 응답으로 연결 상태를 갱신합니다.
    clearPageMessage(); // 이전 오류 안내를 감춥니다.
    return true; // 조회 성공을 호출한 곳에 알립니다.
  } catch (error) { // 인증 실패, API 오류, 네트워크 오류를 처리합니다.
    if (thisRequestNumber !== boxOfficeRequestNumber || requestKey !== kobisApiKey) { // 오래된 요청에서 발생한 오류인지 확인합니다.
      return false; // 현재 화면과 관계없는 오류는 무시합니다.
    } // 오류 요청 순서 확인을 마칩니다.
    boxOfficeStatus.textContent = "박스오피스 조회 실패"; // 실패 상태를 목록 위에 표시합니다.
    showEmptyMessage(boxOfficeList, "박스오피스 자료를 불러오지 못했습니다. 오류 안내를 확인하고 다시 조회해 주세요."); // 결과 대신 실패 상태를 구분해 표시합니다.
    showPageMessage(`박스오피스 조회 오류: ${getReadableError(error)}`); // 오류 원인과 다시 시도 방법을 안내합니다.
    setConnectionStatus("KOBIS API 연결 확인 필요", false); // 연결 상태를 실패로 표시합니다.
    return false; // 조회 실패를 호출한 곳에 알립니다.
  } finally { // 요청이 끝난 뒤 조회 버튼 상태를 정리합니다.
    if (thisRequestNumber === boxOfficeRequestNumber) { // 가장 최근 요청이 끝났는지 확인합니다.
      submitButton.disabled = false; // 다음 조회를 할 수 있게 버튼을 활성화합니다.
    } // 최신 요청 버튼 처리를 마칩니다.
  } // 박스오피스 요청 처리를 마칩니다.
} // 박스오피스 조회 함수를 마칩니다.

// 박스오피스 순위 목록을 영화 카드로 화면에 표시합니다.
function renderBoxOffice(movies) {
  if (movies.length === 0) { // 조회 결과가 있는지 확인합니다.
    showEmptyMessage(boxOfficeList, "선택한 날짜와 영화 종류의 박스오피스 자료가 없습니다."); // 없는 결과를 분명하게 표시합니다.
    return; // 빈 순위 목록에 카드를 만들지 않습니다.
  } // 결과 없음 처리를 마칩니다.
  boxOfficeList.replaceChildren(); // 이전 순위 카드를 지워 중복을 막습니다.
  movies.forEach((movie) => boxOfficeList.append(createMovieCard(movie, true))); // 각 순위 정보를 카드로 바꿔 추가합니다.
} // 박스오피스 렌더링 함수를 마칩니다.

// KOBIS 영화 한 편을 재사용 가능한 카드 요소로 만듭니다.
function createMovieCard(movie, showRank = false) {
  const card = document.createElement("article"); // 영화 카드의 바깥 요소를 만듭니다.
  card.className = "movie-card"; // 카드의 공통 스타일을 적용합니다.
  const posterPlaceholder = document.createElement("div"); // 포스터 자료가 없을 때 쓸 대체 영역입니다.
  posterPlaceholder.className = "movie-poster"; // 포스터 대체 영역 스타일을 적용합니다.
  posterPlaceholder.setAttribute("aria-label", "영화 포스터 정보 미제공"); // 포스터가 아닌 안내 영역임을 보조 기술에 알립니다.
  if (showRank && movie.rank) { // 박스오피스 순위가 있는지 확인합니다.
    const posterRank = document.createElement("span"); // 포스터 대체 영역에 순위를 표시합니다.
    posterRank.className = "movie-rank"; // 순위 숫자에 스타일을 적용합니다.
    posterRank.textContent = `${movie.rank}위`; // API 순위 숫자를 표시합니다.
    posterPlaceholder.append(posterRank); // 순위 표시를 포스터 대체 영역에 넣습니다.
  } // 박스오피스 순위 표시를 마칩니다.
  const posterNote = document.createElement("span"); // 포스터 정보 없음 문구를 만듭니다.
  posterNote.className = "poster-unavailable"; // 작은 안내 글자 스타일을 적용합니다.
  posterNote.textContent = "포스터 정보 없음"; // 제공되지 않는 포스터를 있는 것처럼 보이지 않게 합니다.
  posterPlaceholder.append(posterNote); // 포스터 미제공 안내를 카드에 표시합니다.
  const information = document.createElement("div"); // 영화 제목과 메타 정보를 담을 요소입니다.
  information.className = "movie-card-info"; // 제목과 버튼을 세로로 배치합니다.
  if (showRank && movie.rank) { // 박스오피스 카드인지 확인합니다.
    const rankLabel = document.createElement("p"); // 제목 위에 순위 라벨을 만듭니다.
    rankLabel.className = "rank-label"; // 순위 라벨 스타일을 적용합니다.
    rankLabel.textContent = `BOX OFFICE · ${movie.rank}위`; // 실제 API에서 받은 순위를 표시합니다.
    information.append(rankLabel); // 순위 라벨을 영화 설명에 넣습니다.
  } // 순위 라벨 표시를 마칩니다.
  const title = document.createElement("h3"); // 영화 제목 요소를 만듭니다.
  title.className = "movie-title"; // 영화 제목 스타일을 지정합니다.
  title.textContent = movie.movieNm || "영화 제목 정보 없음"; // API 제목을 안전한 텍스트로 표시합니다.
  information.append(title); // 영화 제목을 카드에 넣습니다.
  const metadata = document.createElement("p"); // 개봉일과 장르 등 부가 정보를 만듭니다.
  metadata.className = "movie-meta"; // 부가 정보 스타일을 지정합니다.
  const metadataParts = []; // 화면에 표시할 실제 API 값만 모읍니다.
  if (movie.openDt) { // 개봉일이 제공되는지 확인합니다.
    metadataParts.push(`개봉 ${formatDisplayDate(movie.openDt)}`); // API 개봉일을 추가합니다.
  } // 개봉일 표시를 마칩니다.
  if (movie.repGenreNm) { // 대표 장르가 제공되는지 확인합니다.
    metadataParts.push(movie.repGenreNm); // API 대표 장르를 추가합니다.
  } // 장르 표시를 마칩니다.
  if (showRank && movie.audiAcc !== undefined) { // 누적 관객 수가 순위 응답에 있는지 확인합니다.
    metadataParts.push(`누적 관객 ${formatNumber(movie.audiAcc)}명`); // API 누적 관객 수를 추가합니다.
  } // 누적 관객 수 표시를 마칩니다.
  metadata.textContent = metadataParts.length > 0 ? metadataParts.join(" · ") : "추가 정보 미제공"; // 정보가 없으면 미제공 상태를 표시합니다.
  information.append(metadata); // 완성한 부가 정보를 카드에 넣습니다.
  const detailButton = document.createElement("button"); // 상세 정보 버튼을 만듭니다.
  detailButton.className = "movie-detail-button"; // 상세 버튼 스타일을 적용합니다.
  detailButton.type = "button"; // 카드 안에서 양식 제출이 일어나지 않게 합니다.
  detailButton.textContent = "영화 상세 정보 보기 →"; // 버튼의 동작을 문장으로 설명합니다.
  if (movie.movieCd) { // 영화 식별 코드가 있는지 확인합니다.
    detailButton.dataset.movieCode = movie.movieCd; // 상세 API에 필요한 영화 코드를 연결합니다.
    detailButton.dataset.movieName = movie.movieNm || "선택한 영화"; // 시간표 안내에 표시할 이름을 연결합니다.
  } else { // 식별 코드가 없으면 상세 요청을 할 수 없습니다.
    detailButton.disabled = true; // 상세 조회가 불가능한 버튼을 비활성화합니다.
    detailButton.textContent = "상세 식별 정보 미제공"; // 사용할 수 없는 이유를 표시합니다.
  } // 영화 코드에 따른 상세 버튼 처리를 마칩니다.
  information.append(detailButton); // 상세 정보 동작을 카드에 넣습니다.
  card.append(posterPlaceholder, information); // 포스터 안내와 영화 정보를 한 카드로 묶습니다.
  return card; // 완성된 영화 카드를 돌려줍니다.
} // 영화 카드 생성 함수를 마칩니다.

// 영화 제목으로 KOBIS 영화 목록을 검색합니다.
async function searchMovies(searchTerm) {
  if (!kobisApiKey) { // 검색 전에 API 키가 입력되어 있는지 확인합니다.
    showPageMessage("영화 검색을 하려면 먼저 KOBIS API 키를 입력해 주세요."); // 키 입력을 안내합니다.
    return; // 키가 없으면 API를 호출하지 않습니다.
  } // API 키 확인을 마칩니다.
  const normalizedSearchTerm = searchTerm.trim(); // 입력한 영화 제목의 앞뒤 공백을 제거합니다.
  if (normalizedSearchTerm.length < 2) { // 검색어가 두 글자 이상인지 확인합니다.
    movieSearchStatus.textContent = "영화 제목을 두 글자 이상 입력해 주세요."; // 검색 조건을 상태 문구로 표시합니다.
    showEmptyMessage(movieSearchResults, "정확한 검색을 위해 영화 제목을 두 글자 이상 입력해 주세요."); // 검색 방법을 알려줍니다.
    return; // 짧은 검색어는 API에 보내지 않습니다.
  } // 검색어 길이 확인을 마칩니다.
  const thisRequestNumber = ++movieSearchRequestNumber; // 검색 순서를 기록해 오래된 응답을 걸러냅니다.
  const requestKey = kobisApiKey; // 검색을 시작할 때의 키 값을 기억합니다.
  movieSearchStatus.textContent = "KOBIS 영화 정보를 검색하고 있습니다..."; // 검색 중임을 알립니다.
  showEmptyMessage(movieSearchResults, "영화 목록을 불러오고 있습니다."); // 이전 결과 대신 진행 상태를 표시합니다.
  const submitButton = movieSearchForm.querySelector("button[type='submit']"); // 영화 검색 버튼을 찾습니다.
  submitButton.disabled = true; // 중복 검색 요청을 방지합니다.
  try { // 영화 검색 API 호출과 결과 표시를 수행합니다.
    const responseData = await requestKobisApi("movie/searchMovieList.json", { movieNm: normalizedSearchTerm, curPage: 1, itemPerPage: 30 }); // 영화 제목에 일치하는 결과를 최대 30개 요청합니다.
    if (thisRequestNumber !== movieSearchRequestNumber || requestKey !== kobisApiKey) { // 새 검색이나 키 변경이 있었는지 확인합니다.
      return; // 오래된 검색 결과는 표시하지 않습니다.
    } // 최신 검색 확인을 마칩니다.
    const movieList = responseData.movieListResult?.movieList; // KOBIS 영화 목록을 가져옵니다.
    if (!Array.isArray(movieList)) { // API 응답 구조가 맞는지 검사합니다.
      throw new Error("영화 검색 응답에 영화 목록이 없습니다."); // 응답 누락을 명확한 오류로 처리합니다.
    } // 영화 목록 확인을 마칩니다.
    lastMovieSearchResults = movieList; // 장르 필터가 사용할 원본 검색 결과를 보관합니다.
    renderMovieSearchResults(); // 현재 장르 조건에 맞는 결과를 표시합니다.
    movieSearchStatus.textContent = `검색 결과 ${movieList.length}편 · 이 화면 조회 시각 ${getCurrentTimeLabel()}`; // 결과 수와 조회 시각을 표시합니다.
    clearPageMessage(); // 이전 API 오류 안내를 지웁니다.
  } catch (error) { // API 키, 서버, 네트워크 오류를 안내합니다.
    if (thisRequestNumber !== movieSearchRequestNumber || requestKey !== kobisApiKey) { // 오래된 요청에서 생긴 오류인지 확인합니다.
      return; // 현재 검색과 관계없는 오류는 표시하지 않습니다.
    } // 최신 검색 오류 확인을 마칩니다.
    movieSearchStatus.textContent = "영화 검색 실패"; // 검색 실패 상태를 표시합니다.
    showEmptyMessage(movieSearchResults, "영화 검색 결과를 불러오지 못했습니다. 오류 안내를 확인해 주세요."); // 실패를 빈 검색 결과와 구분합니다.
    showPageMessage(`영화 검색 오류: ${getReadableError(error)}`); // 원인과 해결 방향을 알려줍니다.
  } finally { // 현재 검색 요청이 끝나면 버튼 상태를 정리합니다.
    if (thisRequestNumber === movieSearchRequestNumber) { // 가장 최근 검색이 끝났는지 검사합니다.
      submitButton.disabled = false; // 다음 검색을 할 수 있도록 버튼을 활성화합니다.
    } // 최신 검색 버튼 처리를 마칩니다.
  } // 검색 요청 처리를 마칩니다.
} // 영화 검색 함수를 마칩니다.

// 마지막 검색 결과에서 선택한 장르와 일치하는 영화만 표시합니다.
function renderMovieSearchResults() {
  const selectedGenre = genreFilter.value; // 현재 선택한 장르 조건을 가져옵니다.
  const filteredMovies = selectedGenre ? lastMovieSearchResults.filter((movie) => (movie.repGenreNm || "").includes(selectedGenre)) : lastMovieSearchResults; // 장르가 선택되면 해당 장르가 포함된 영화만 남깁니다.
  if (filteredMovies.length === 0) { // 필터 적용 후 결과가 있는지 확인합니다.
    const message = selectedGenre ? `${selectedGenre} 장르에 해당하는 검색 결과가 없습니다.` : "검색 결과가 없습니다. 다른 제목을 입력해 주세요."; // 결과가 없는 이유를 구분합니다.
    showEmptyMessage(movieSearchResults, message); // 조건을 바꾸도록 빈 상태를 표시합니다.
    return; // 빈 결과 카드가 만들어지지 않게 합니다.
  } // 검색 결과 없음 처리를 마칩니다.
  movieSearchResults.replaceChildren(); // 이전 검색 카드를 지웁니다.
  filteredMovies.forEach((movie) => movieSearchResults.append(createMovieCard(movie))); // 필터된 영화 정보를 카드로 표시합니다.
} // 검색 결과 필터 함수를 마칩니다.

// 영화 코드로 KOBIS 상세 정보를 요청해 대화상자에 표시합니다.
async function showMovieDetails(movieCode, movieName) {
  selectedMovieName.textContent = `선택한 영화: ${movieName} · 실제 상영 시간표는 KOBIS API에서 제공되지 않습니다.`; // 시간표 안내에 선택한 영화와 데이터 한계를 표시합니다.
  movieDetailDialog.showModal(); // 접근성 있는 브라우저 대화상자를 엽니다.
  renderMovieDetailLoading(movieName); // 응답을 기다리는 동안 로딩 상태를 표시합니다.
  try { // 영화 상세 API를 호출합니다.
    const responseData = await requestKobisApi("movie/searchMovieInfo.json", { movieCd: movieCode }); // 식별 코드에 해당하는 영화 정보를 요청합니다.
    const movieInfo = responseData.movieInfoResult?.movieInfo; // 상세 정보 객체를 가져옵니다.
    if (!movieInfo) { // 상세 응답에 영화 정보가 있는지 확인합니다.
      throw new Error("선택한 영화의 상세 정보가 제공되지 않습니다."); // 정보 누락을 정상 결과처럼 취급하지 않습니다.
    } // 상세 응답 확인을 마칩니다.
    renderMovieDetails(movieInfo); // 제공된 실제 상세 정보를 대화상자에 표시합니다.
  } catch (error) { // 네트워크, 키, 상세 자료 오류를 처리합니다.
    movieDetailContent.replaceChildren(); // 이전 상세 정보를 지웁니다.
    const errorMessage = document.createElement("p"); // 오류 안내 문단을 만듭니다.
    errorMessage.className = "empty-message"; // 안내 문구 스타일을 적용합니다.
    errorMessage.textContent = `상세 정보를 불러오지 못했습니다. ${getReadableError(error)}`; // 실패 이유를 사용자에게 표시합니다.
    movieDetailContent.append(errorMessage); // 오류 안내를 대화상자에 넣습니다.
  } // 상세 정보 요청 처리를 마칩니다.
} // 영화 상세 조회 함수를 마칩니다.

// 상세 정보를 기다리는 동안 영화 제목과 진행 안내를 표시합니다.
function renderMovieDetailLoading(movieName) {
  movieDetailContent.replaceChildren(); // 이전 영화 상세 정보를 지웁니다.
  const heading = document.createElement("h2"); // 대화상자 제목을 만듭니다.
  heading.id = "detail-title"; // 대화상자 접근성 제목으로 연결합니다.
  heading.className = "detail-heading"; // 제목 스타일을 적용합니다.
  heading.textContent = movieName; // 선택한 영화 제목을 표시합니다.
  const loadingMessage = document.createElement("p"); // 로딩 상태를 표시할 문단입니다.
  loadingMessage.className = "empty-message"; // 로딩 문구에 빈 상태 스타일을 사용합니다.
  loadingMessage.textContent = "KOBIS 영화 상세 정보를 불러오고 있습니다."; // 진행 중임을 알립니다.
  movieDetailContent.append(heading, loadingMessage); // 영화 제목과 진행 안내를 표시합니다.
} // 상세 정보 로딩 화면 함수를 마칩니다.

// KOBIS 상세 응답에서 배열 형식의 정보를 읽기 쉬운 문장으로 바꿉니다.
function joinApiNames(items, nameKey) {
  if (!Array.isArray(items) || items.length === 0) { // 이름 목록이 제공되는지 확인합니다.
    return "정보 미제공"; // 비어 있는 목록을 분명하게 표시합니다.
  } // 목록 없음 처리를 마칩니다.
  const names = items.map((item) => item?.[nameKey]).filter(Boolean); // 각 배열 항목에서 실제 이름만 가져옵니다.
  return names.length > 0 ? names.join(", ") : "정보 미제공"; // 이름이 있으면 쉼표로 연결합니다.
} // API 이름 목록 변환 함수를 마칩니다.

// 영화 상세 API에서 제공한 항목만 대화상자에 표시합니다.
function renderMovieDetails(movie) {
  movieDetailContent.replaceChildren(); // 이전 영화 정보를 지웁니다.
  const heading = document.createElement("h2"); // 영화 상세 제목을 만듭니다.
  heading.id = "detail-title"; // 대화상자의 접근성 제목으로 사용합니다.
  heading.className = "detail-heading"; // 제목에 스타일을 적용합니다.
  heading.textContent = movie.movieNm || "영화 제목 정보 미제공"; // API 영화 제목을 안전하게 표시합니다.
  const subtitle = document.createElement("p"); // 영문 또는 원제 제목을 표시할 문단입니다.
  subtitle.className = "detail-subtitle"; // 보조 제목 스타일을 지정합니다.
  subtitle.textContent = movie.movieNmEn || movie.movieNmOg || "영문 제목 정보 미제공"; // API가 제공한 제목만 표시합니다.
  const detailList = document.createElement("dl"); // 이름과 값으로 영화 정보를 나타내는 목록입니다.
  detailList.className = "detail-list"; // 상세 항목을 두 열로 배치합니다.
  const detailRows = [ // 화면에 표시할 상세 항목과 실제 API 값을 연결합니다.
    ["개봉일", formatDisplayDate(movie.openDt)], // 영화 개봉일 항목입니다.
    ["상영 시간", movie.showTm ? `${formatNumber(movie.showTm)}분` : "정보 미제공"], // 영화 러닝타임 항목입니다.
    ["장르", joinApiNames(movie.genres, "genreNm")], // 영화 장르 항목입니다.
    ["감독", joinApiNames(movie.directors, "peopleNm")], // 영화 감독 항목입니다.
    ["출연", joinApiNames(movie.actors?.slice(0, 6), "peopleNm")], // API가 제공한 출연자 중 최대 6명을 표시합니다.
    ["관람 등급", joinApiNames(movie.audits, "watchGradeNm")], // 관람 등급 항목입니다.
    ["제작 국가", joinApiNames(movie.nations, "nationNm")], // 제작 국가 항목입니다.
    ["포스터", "KOBIS 영화 정보 API에서 제공되지 않습니다."], // 사용하지 않는 포스터 자료를 미제공으로 표시합니다.
    ["극장별 시간표", "KOBIS 영화 정보 API에서 제공되지 않습니다."] // 영화 식별 정보와 회차 데이터를 구분합니다.
  ]; // 표시할 상세 항목을 정의합니다.
  detailRows.forEach(([label, value]) => { // 상세 항목마다 이름과 값을 만듭니다.
    const labelElement = document.createElement("dt"); // 정보 이름 요소를 만듭니다.
    labelElement.textContent = label; // 정보 이름을 표시합니다.
    const valueElement = document.createElement("dd"); // 정보 값 요소를 만듭니다.
    valueElement.textContent = value || "정보 미제공"; // API 데이터가 비어 있어도 화면이 깨지지 않게 합니다.
    detailList.append(labelElement, valueElement); // 이름과 값을 목록에 추가합니다.
  }); // 상세 정보 목록 생성을 마칩니다.
  const synopsisText = movie.synop || movie.synopsis; // API 응답에 줄거리가 포함되어 있는지 확인합니다.
  const synopsis = document.createElement("p"); // 줄거리나 미제공 상태를 담을 문단입니다.
  synopsis.className = "detail-synopsis"; // 줄거리 문단 스타일을 지정합니다.
  synopsis.textContent = synopsisText || "줄거리 정보는 KOBIS API에서 제공되지 않습니다."; // 줄거리가 없으면 미제공 상태를 안내합니다.
  movieDetailContent.append(heading, subtitle, detailList, synopsis); // 상세 제목과 제공 가능한 정보를 대화상자에 표시합니다.
} // 영화 상세 화면 렌더링 함수를 마칩니다.

// API 키 입력 양식을 처리하고 박스오피스를 불러옵니다.
apiKeyForm.addEventListener("submit", async (event) => {
  event.preventDefault(); // 키를 제출해도 페이지가 새로고침되지 않게 합니다.
  const enteredKey = apiKeyInput.value.trim(); // 입력한 키의 앞뒤 공백을 제거합니다.
  if (!enteredKey) { // 빈 키인지 확인합니다.
    showPageMessage("KOBIS API 키를 입력해 주세요."); // 키 입력을 안내합니다.
    apiKeyInput.focus(); // 사용자가 키 입력창으로 바로 이동하게 합니다.
    return; // 빈 키로는 요청하지 않습니다.
  } // 키 입력 확인을 마칩니다.
  kobisApiKey = enteredKey; // 키를 페이지 메모리에만 저장합니다.
  connectButton.disabled = true; // 중복 연결 요청을 막습니다.
  connectButton.textContent = "연결 중..."; // 연결 진행 상태를 버튼에 표시합니다.
  setConnectionStatus("KOBIS API 연결 중...", false); // 헤더 상태를 갱신합니다.
  await loadBoxOffice(); // 현재 날짜와 영화 종류에 해당하는 순위를 요청합니다.
  connectButton.disabled = false; // 요청이 끝나면 버튼을 다시 활성화합니다.
  connectButton.textContent = "영화 정보 불러오기"; // 버튼의 기본 문구를 복원합니다.
}); // API 키 입력 이벤트를 연결합니다.

// API 키가 바뀌면 이전 키를 메모리에서 지우고 다시 연결하게 합니다.
apiKeyInput.addEventListener("input", () => {
  kobisApiKey = ""; // 수정 중인 키가 요청에 잘못 사용되지 않도록 이전 키를 비웁니다.
  setConnectionStatus("새 키로 다시 연결해 주세요", false); // 새 키를 확인해야 함을 알립니다.
}); // API 키 변경 이벤트를 연결합니다.

// 날짜나 영화 종류를 바꾸면 새 박스오피스 자료를 요청합니다.
boxOfficeForm.addEventListener("submit", (event) => {
  event.preventDefault(); // 필터 조회 중 페이지가 새로고침되지 않게 합니다.
  loadBoxOffice(); // 선택한 기준 날짜와 영화 종류를 API에 요청합니다.
}); // 박스오피스 필터 이벤트를 연결합니다.

// 영화 이름 검색을 KOBIS 영화 검색 API와 연결합니다.
movieSearchForm.addEventListener("submit", (event) => {
  event.preventDefault(); // 검색 중 페이지가 새로고침되지 않게 합니다.
  searchMovies(movieSearchInput.value); // 입력한 제목을 API에 검색합니다.
}); // 영화 검색 이벤트를 연결합니다.

// 검색 결과에서 장르를 바꾸면 저장된 결과에 장르 조건을 다시 적용합니다.
genreFilter.addEventListener("change", renderMovieSearchResults); // 장르 필터를 결과 화면과 연결합니다.

// 박스오피스와 검색 결과의 영화 상세 버튼을 눌렀을 때 API 정보를 불러옵니다.
document.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-movie-code]"); // 실제로 누른 영화 상세 버튼을 찾습니다.
  if (!detailButton) { // 상세 버튼을 누르지 않은 경우를 확인합니다.
    return; // 다른 버튼 동작을 방해하지 않습니다.
  } // 상세 버튼 확인을 마칩니다.
  showMovieDetails(detailButton.dataset.movieCode, detailButton.dataset.movieName); // 해당 영화의 상세 API를 조회합니다.
}); // 영화 카드 이벤트를 연결합니다.

// 닫기 버튼을 누르면 상세 정보 대화상자를 닫습니다.
closeDetailButton.addEventListener("click", () => movieDetailDialog.close()); // 상세 닫기 버튼 이벤트를 연결합니다.

// 대화상자 바깥의 어두운 영역을 누르면 상세 팝업을 닫습니다.
movieDetailDialog.addEventListener("click", (event) => {
  if (event.target === movieDetailDialog) { // 실제 대화상자 바깥 영역을 눌렀는지 확인합니다.
    movieDetailDialog.close(); // 화면을 가리는 팝업을 닫습니다.
  } // 배경 클릭 처리를 마칩니다.
}); // 대화상자 바깥 클릭 이벤트를 연결합니다.

// 첫 화면을 열 때 조회하기 편하도록 전날을 박스오피스 기본 날짜로 지정합니다.
setDefaultSearchDate(); // KOBIS 일별 순위의 기본 기준일을 설정합니다.
