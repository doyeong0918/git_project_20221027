"use strict"; // 엄격 모드로 작성하지 않은 변수 사용 같은 실수를 빠르게 찾습니다.

// 실제 장소 검색, 날씨, 대기질을 제공하는 Open-Meteo API 주소입니다.
const apiEndpoints = {
  geocoding: "https://geocoding-api.open-meteo.com/v1/search", // 장소 이름을 위도와 경도로 바꾸는 API입니다.
  weather: "https://api.open-meteo.com/v1/forecast", // 현재 날씨와 오늘 예보를 제공하는 API입니다.
  airQuality: "https://air-quality-api.open-meteo.com/v1/air-quality" // 대기질 정보를 제공하는 API입니다.
}; // 사용하는 API 주소를 한곳에서 관리합니다.

// 빠른 지역 버튼에서 선택할 수 있는 대한민국 주요 장소와 좌표입니다.
const quickLocations = [
  { id: "seoul", name: "서울", region: "대한민국 서울특별시 중구", latitude: 37.5636, longitude: 126.9975 }, // 서울 도심 대표 좌표입니다.
  { id: "suwon", name: "수원", region: "대한민국 경기도 수원시", latitude: 37.2636, longitude: 127.0286 }, // 수원 대표 좌표입니다.
  { id: "busan", name: "부산", region: "대한민국 부산광역시", latitude: 35.1796, longitude: 129.0756 }, // 부산 대표 좌표입니다.
  { id: "jeju", name: "제주", region: "대한민국 제주특별자치도 제주시", latitude: 33.4996, longitude: 126.5312 } // 제주 대표 좌표입니다.
]; // API 요청에 사용할 빠른 지역 목록을 정의합니다.

// 검색 장소와 빠른 지역을 식별자로 찾을 수 있게 보관합니다.
const knownLocations = new Map(quickLocations.map((location) => [location.id, location])); // 화면에서 선택 가능한 장소를 등록합니다.

// 화면 요소를 찾아 API 결과를 알맞은 위치에 표시할 준비를 합니다.
const searchForm = document.querySelector("#search-form"); // 장소 검색 양식입니다.
const searchInput = document.querySelector("#place-search"); // 검색어를 입력하는 칸입니다.
const searchButton = searchForm.querySelector("button[type='submit']"); // 검색 중 비활성화할 버튼입니다.
const searchResultsSection = document.querySelector("#search-results-section"); // 검색 결과 표시 영역입니다.
const searchResultsTitle = document.querySelector("#search-results-title"); // 검색 결과 개수나 상태를 표시합니다.
const searchResults = document.querySelector("#search-results"); // 검색 결과 버튼 목록입니다.
const emptyState = document.querySelector("#empty-state"); // 장소 선택 전 안내 화면입니다.
const weatherDashboard = document.querySelector("#weather-dashboard"); // 선택한 장소의 날씨 화면입니다.
const favoriteToggle = document.querySelector("#favorite-toggle"); // 관심 장소 저장 버튼입니다.
const favoritesList = document.querySelector("#favorites-list"); // 저장된 장소 목록입니다.
const favoritesCount = document.querySelector("#favorites-count"); // 저장 장소 개수입니다.
const weatherMessage = document.querySelector("#weather-message"); // 로딩 상태나 API 오류를 표시합니다.
const dailyForecast = document.querySelector("#daily-forecast"); // 하루 예보 카드 영역입니다.
const todayDate = document.querySelector("#today-date"); // API가 돌려준 오늘 날짜를 표시합니다.

// 선택 장소와 API 요청 상태, 관심 장소를 화면 상태로 관리합니다.
let selectedLocation = null; // 사용자가 현재 선택한 장소 정보입니다.
let favoriteLocations = []; // 브라우저에 저장할 관심 장소 정보입니다.
let weatherRequestNumber = 0; // 빠른 장소 변경 때 오래된 응답을 무시하기 위한 번호입니다.
let searchRequestNumber = 0; // 빠른 연속 검색 때 오래된 응답을 무시하기 위한 번호입니다.

// 오늘 날짜를 한국어 요일과 월, 일 형식으로 표시합니다.
function getTodayLabel(dateString) {
  if (!dateString) { // API 날짜가 없을 때만 기기 날짜를 사용합니다.
    return new Intl.DateTimeFormat("ko-KR", { weekday: "long", month: "long", day: "numeric" }).format(new Date()); // 선택 전 화면의 날짜를 만듭니다.
  } // API 날짜가 없는 경우의 처리를 마칩니다.
  const [year, month, day] = dateString.split("-").map(Number); // API의 연도, 월, 일을 숫자로 나눕니다.
  const localDate = new Date(year, month - 1, day); // 화면에 표시할 날짜 객체를 만듭니다.
  return new Intl.DateTimeFormat("ko-KR", { weekday: "long", month: "long", day: "numeric" }).format(localDate); // API 날짜를 한국어로 표시합니다.
} // 날짜 표시 함수를 마칩니다.

// 검색어나 날씨 데이터의 문자를 HTML 코드가 아닌 일반 글자로 안전하게 표시합니다.
function escapeHtml(text) {
  const safeCharacters = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }; // HTML에서 특별한 의미가 있는 문자를 모읍니다.
  return String(text).replace(/[&<>"']/g, (character) => safeCharacters[character]); // 입력 문자열의 특수 문자를 안전한 형태로 바꿉니다.
} // 문자 변환 함수를 마칩니다.

// 화면 아래에 저장 문제와 같은 공통 안내 문구를 표시합니다.
function showPageMessage(message) {
  const existingMessage = document.querySelector("#page-message"); // 이미 공통 안내가 있는지 확인합니다.
  if (existingMessage) { // 기존 안내 문구가 있으면 내용을 갱신합니다.
    existingMessage.textContent = message; // 새 안내 내용을 화면에 표시합니다.
    return; // 같은 안내 상자를 다시 사용합니다.
  } // 기존 안내 문구 처리를 마칩니다.
  const messageElement = document.createElement("p"); // 새 안내 문구를 담을 문단을 만듭니다.
  messageElement.id = "page-message"; // 다음에 찾아 갱신할 수 있도록 식별자를 지정합니다.
  messageElement.className = "page-message"; // 안내 문구의 스타일을 지정합니다.
  messageElement.setAttribute("role", "status"); // 보조 기술이 안내 변화를 읽도록 합니다.
  messageElement.textContent = message; // 안내 문구를 안전한 텍스트로 넣습니다.
  document.querySelector(".site-footer").before(messageElement); // 페이지 푸터 바로 앞에 안내를 추가합니다.
} // 공통 안내 표시 함수를 마칩니다.

// 브라우저 저장 공간에서 관심 장소 전체 정보를 불러옵니다.
function loadFavoriteLocations() {
  try { // 브라우저가 저장 공간에 접근할 수 있는지 확인합니다.
    const savedValue = window.localStorage.getItem("open-meteo-favorites"); // 이전에 저장한 관심 장소를 읽습니다.
    const savedLocations = savedValue ? JSON.parse(savedValue) : []; // 저장된 JSON을 목록으로 바꾸거나 빈 목록을 사용합니다.
    if (!Array.isArray(savedLocations)) { // 저장 값이 장소 목록인지 확인합니다.
      throw new Error("저장된 장소 목록의 형식이 올바르지 않습니다."); // 잘못된 저장 내용을 오류 처리에 전달합니다.
    } // 저장 목록 형식 확인을 마칩니다.
    const validLocations = savedLocations.filter((location) => location && typeof location.id === "string" && typeof location.name === "string" && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)); // 장소 이름과 좌표가 모두 있는 데이터만 남깁니다.
    validLocations.forEach((location) => knownLocations.set(location.id, location)); // 저장된 장소를 장소 찾기 목록에 다시 등록합니다.
    if (validLocations.length !== savedLocations.length) { // 형식이 맞지 않는 저장 장소가 있었는지 확인합니다.
      showPageMessage("일부 관심 장소 정보를 읽지 못했습니다. 저장 목록을 확인해 주세요."); // 누락된 데이터가 있음을 알립니다.
    } // 저장 목록 확인을 마칩니다.
    return validLocations; // 사용할 수 있는 관심 장소만 반환합니다.
  } catch (error) { // 저장 공간이 꺼져 있거나 내용이 잘못된 상황을 처리합니다.
    showPageMessage("관심 장소를 불러오지 못했습니다. 브라우저 저장 공간을 확인해 주세요."); // 사용자가 문제를 알 수 있도록 안내합니다.
    return []; // 잘못된 저장 목록 대신 빈 목록에서 시작합니다.
  } // 저장 공간 읽기 시도를 마칩니다.
} // 관심 장소 불러오기 함수를 마칩니다.

// 관심 장소의 이름과 좌표를 브라우저 저장 공간에 기록합니다.
function saveFavoriteLocations() {
  try { // 브라우저 저장 공간에 장소 목록 기록을 시도합니다.
    window.localStorage.setItem("open-meteo-favorites", JSON.stringify(favoriteLocations)); // 장소 검색 결과가 다시 열리도록 전체 정보를 저장합니다.
    return true; // 저장이 성공했음을 호출한 곳에 알립니다.
  } catch (error) { // 저장 공간이 가득 찼거나 사용할 수 없는 상황을 처리합니다.
    showPageMessage("관심 장소를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요."); // 저장 실패 이유와 해결 방향을 알려줍니다.
    return false; // 저장이 실패했음을 호출한 곳에 알립니다.
  } // 저장 시도를 마칩니다.
} // 관심 장소 저장 함수를 마칩니다.

// API 주소와 검색 조건을 결합해 요청 주소를 만듭니다.
function buildApiUrl(endpoint, parameters) {
  const requestUrl = new URL(endpoint); // API의 기본 주소를 URL 객체로 바꿉니다.
  Object.entries(parameters).forEach(([name, value]) => requestUrl.searchParams.set(name, String(value))); // 각 검색 조건을 주소에 안전하게 추가합니다.
  return requestUrl.toString(); // 완성한 API 요청 주소를 반환합니다.
} // API 주소 생성 함수를 마칩니다.

// API에 요청을 보내고 정상적인 JSON 응답을 받았는지 확인합니다.
async function fetchApiData(requestUrl, serviceName) {
  const response = await fetch(requestUrl); // 지정한 API에 네트워크 요청을 보냅니다.
  if (!response.ok) { // 서버가 성공 상태 코드를 반환했는지 확인합니다.
    throw new Error(`${serviceName} 요청에 실패했습니다. (HTTP ${response.status})`); // 서버 오류를 호출한 곳에 분명히 전달합니다.
  } // HTTP 응답 확인을 마칩니다.
  const responseData = await response.json(); // 응답 본문을 JSON 데이터로 읽습니다.
  if (responseData.error) { // API 자체가 오류를 알렸는지 검사합니다.
    throw new Error(`${serviceName}: ${responseData.reason || "요청을 처리할 수 없습니다."}`); // API가 제공한 실패 이유를 전달합니다.
  } // API 오류 확인을 마칩니다.
  return responseData; // 검증한 API 결과를 호출한 곳에 반환합니다.
} // API 요청 함수를 마칩니다.

// 장소 검색 API에서 검색한 장소를 화면에서 사용하는 형태로 바꿉니다.
function convertSearchResultToLocation(result) {
  const regionParts = [result.admin2, result.admin1, result.country].filter(Boolean); // 시·도와 국가처럼 제공된 지역 정보를 모읍니다.
  const locationId = result.id ? `geoname:${result.id}` : `coordinates:${result.latitude},${result.longitude}`; // 검색 결과를 다시 찾을 수 있는 식별자를 만듭니다.
  return {
    id: locationId, // 관심 장소와 화면에서 사용할 고유 식별자입니다.
    name: result.name, // API가 찾은 장소의 이름입니다.
    region: regionParts.join(" · ") || "지역 정보 없음", // 구분에 필요한 행정구역 설명입니다.
    latitude: Number(result.latitude), // 날씨 조회에 사용할 위도입니다.
    longitude: Number(result.longitude) // 날씨 조회에 사용할 경도입니다.
  }; // 화면에서 사용할 장소 정보를 돌려줍니다.
} // 검색 결과 변환 함수를 마칩니다.

// API가 정확한 행정구역 이름으로 검색하도록 흔한 두 글자 지역명을 보완합니다.
function getGeocodingSearchName(searchTerm) {
  const koreanCityNames = { // 짧은 일상 지명을 API가 찾을 수 있는 정식 행정구역 이름으로 바꿉니다.
    서울: "서울특별시", // 서울은 API에 등록된 정식 도시 이름으로 검색합니다.
    수원: "수원시", // 수원은 시 단위 정식 이름으로 검색합니다.
    부산: "부산광역시", // 부산은 광역시 이름으로 검색합니다.
    인천: "인천광역시", // 인천은 광역시 이름으로 검색합니다.
    대구: "대구광역시", // 대구는 광역시 이름으로 검색합니다.
    광주: "광주광역시", // 광주는 광역시 이름으로 검색합니다.
    대전: "대전광역시", // 대전은 광역시 이름으로 검색합니다.
    울산: "울산광역시", // 울산은 광역시 이름으로 검색합니다.
    세종: "세종특별자치시", // 세종은 특별자치시 이름으로 검색합니다.
    제주: "제주특별자치도", // 제주는 도 단위 정식 이름으로 검색합니다.
    경기: "경기도", // 경기는 도 단위 정식 이름으로 검색합니다.
    강원: "강원도", // 강원은 도 단위 정식 이름으로 검색합니다.
    충남: "충청남도", // 충남은 도 단위 정식 이름으로 검색합니다.
    충북: "충청북도", // 충북은 도 단위 정식 이름으로 검색합니다.
    전남: "전라남도", // 전남은 도 단위 정식 이름으로 검색합니다.
    전북: "전라북도", // 전북은 도 단위 정식 이름으로 검색합니다.
    경남: "경상남도", // 경남은 도 단위 정식 이름으로 검색합니다.
    경북: "경상북도" // 경북은 도 단위 정식 이름으로 검색합니다.
  }; // 짧은 지역명과 API 검색 이름의 관계를 정의합니다.
  return koreanCityNames[searchTerm] || searchTerm; // 등록된 지역만 정식 이름으로 바꿉니다.
} // 장소 검색어 보완 함수를 마칩니다.

// 입력한 장소 이름을 실제 지오코딩 API에 요청해 검색합니다.
async function searchLocations(searchTerm) {
  const normalizedSearchTerm = searchTerm.trim(); // 검색어 앞뒤의 공백을 제거합니다.
  const thisSearchNumber = ++searchRequestNumber; // 이 검색이 가장 최근 검색인지 확인할 번호를 만듭니다.
  searchResults.replaceChildren(); // 이전 검색 결과를 지워 중복을 막습니다.
  searchResultsSection.hidden = false; // 검색 결과 영역을 화면에 표시합니다.
  if (normalizedSearchTerm.length < 2) { // 장소 검색에 필요한 최소 글자 수인지 확인합니다.
    searchResultsTitle.textContent = "두 글자 이상 입력해 주세요"; // 검색할 수 있는 조건을 제목에 표시합니다.
    showNoSearchResults("장소 이름을 두 글자 이상 입력하면 검색할 수 있어요."); // 검색 방법을 안내합니다.
    return; // API에 빈 검색어를 보내지 않습니다.
  } // 검색어 길이 확인을 마칩니다.
  searchResultsTitle.textContent = "장소를 검색하고 있습니다..."; // 검색 중임을 알립니다.
  searchButton.disabled = true; // 검색 중 중복 요청을 막습니다.
  try { // 장소 검색 API 요청과 결과 표시를 수행합니다.
    const apiSearchName = getGeocodingSearchName(normalizedSearchTerm); // API가 정확히 찾을 수 있도록 짧은 지역 이름을 보완합니다.
    const requestUrl = buildApiUrl(apiEndpoints.geocoding, { name: apiSearchName, count: 8, language: "ko", format: "json" }); // 한국어 최대 8개 실제 장소를 요청합니다.
    const responseData = await fetchApiData(requestUrl, "장소 검색 API"); // 실제 장소 검색 결과를 가져옵니다.
    if (thisSearchNumber !== searchRequestNumber) { // 더 최근 검색이 시작되었는지 확인합니다.
      return; // 먼저 시작한 오래된 검색 결과는 표시하지 않습니다.
    } // 최신 검색 확인을 마칩니다.
    const matchedLocations = (responseData.results || []).filter((result) => Number.isFinite(Number(result.latitude)) && Number.isFinite(Number(result.longitude)) && result.name).map(convertSearchResultToLocation); // 좌표가 정상인 검색 결과만 장소 정보로 바꿉니다.
    searchResultsTitle.textContent = `검색 결과 ${matchedLocations.length}곳`; // 검색된 장소의 개수를 표시합니다.
    if (matchedLocations.length === 0) { // API 결과가 비어 있는지 확인합니다.
      showNoSearchResults("일치하는 장소가 없어요. 다른 이름이나 지역을 입력해 주세요."); // 다시 검색할 수 있도록 안내합니다.
      return; // 결과가 없으면 선택 버튼을 만들지 않습니다.
    } // 검색 결과 없음 처리를 마칩니다.
    matchedLocations.forEach((location) => { // 검색된 각 장소에 선택 버튼을 만듭니다.
      knownLocations.set(location.id, location); // 관심 장소 저장과 선택을 위해 장소 정보를 등록합니다.
      const resultButton = document.createElement("button"); // 장소를 고르는 버튼을 만듭니다.
      resultButton.type = "button"; // 검색 결과 선택이 양식을 제출하지 않게 합니다.
      resultButton.className = "result-button"; // 검색 결과 버튼의 스타일을 지정합니다.
      resultButton.dataset.locationId = location.id; // 선택할 장소 식별자를 버튼에 연결합니다.
      resultButton.innerHTML = `<span><span class="result-name">${escapeHtml(location.name)}</span><span class="result-region">${escapeHtml(location.region)}</span></span><span aria-hidden="true">→</span>`; // 장소 이름과 지역을 안전하게 표시합니다.
      searchResults.append(resultButton); // 완성한 장소 버튼을 검색 결과에 추가합니다.
    }); // 검색 결과 버튼 생성을 마칩니다.
  } catch (error) { // 네트워크 연결이나 장소 검색 API 오류를 처리합니다.
    if (thisSearchNumber !== searchRequestNumber) { // 오류가 오래된 검색에서 발생했는지 확인합니다.
      return; // 이미 새 검색이 진행 중이면 이전 오류를 표시하지 않습니다.
    } // 검색 오류 순서 확인을 마칩니다.
    searchResultsTitle.textContent = "장소를 검색할 수 없습니다"; // 검색 실패 상태를 제목에 표시합니다.
    showNoSearchResults(`${getReadableApiError(error)} 장소 검색을 다시 시도해 주세요.`); // 오류 원인과 다음 행동을 안내합니다.
  } finally { // 현재 검색 요청이 끝난 뒤 버튼 상태를 정리합니다.
    if (thisSearchNumber === searchRequestNumber) { // 가장 최근 검색이 끝났는지 확인합니다.
      searchButton.disabled = false; // 다음 검색을 할 수 있도록 버튼을 활성화합니다.
    } // 최신 검색 버튼 처리를 마칩니다.
  } // 검색 요청 처리를 마칩니다.
} // 장소 검색 함수를 마칩니다.

// 검색 결과가 없거나 장소 검색 중인 이유를 문장으로 표시합니다.
function showNoSearchResults(message) {
  const messageElement = document.createElement("p"); // 검색 안내를 담을 문단을 만듭니다.
  messageElement.className = "no-results"; // 검색 안내용 스타일을 지정합니다.
  messageElement.textContent = message; // 안내 내용을 일반 문장으로 표시합니다.
  searchResults.append(messageElement); // 안내 문구를 검색 결과 영역에 추가합니다.
} // 검색 안내 함수를 마칩니다.

// 네트워크 오류를 사용자가 이해하기 쉬운 문장으로 바꿉니다.
function getReadableApiError(error) {
  if (error instanceof TypeError) { // 네트워크 연결이나 브라우저 접근 오류인지 확인합니다.
    return "인터넷 연결 또는 API 접근 상태를 확인해 주세요."; // 다시 연결할 수 있도록 안내합니다.
  } // 네트워크 오류 설명을 마칩니다.
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."; // API가 제공한 오류 또는 일반 안내를 반환합니다.
} // API 오류 설명 함수를 마칩니다.

// 장소 이름과 좌표를 이용해 현재 날씨와 오늘 예보를 요청합니다.
async function fetchWeatherData(location) {
  const requestUrl = buildApiUrl(apiEndpoints.weather, { // 날씨 변수와 선택 장소를 요청 주소에 넣습니다.
    latitude: location.latitude, // 선택한 장소의 위도를 전달합니다.
    longitude: location.longitude, // 선택한 장소의 경도를 전달합니다.
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m", // 현재 기온, 습도, 체감온도, 강수, 상태, 바람을 요청합니다.
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum", // 오늘 날씨와 최저·최고 기온, 강수 예보를 요청합니다.
    temperature_unit: "celsius", // 기온을 섭씨로 받습니다.
    wind_speed_unit: "ms", // 바람 속도를 초속 미터로 받습니다.
    timezone: "auto", // 선택한 장소의 시간대를 사용합니다.
    forecast_days: 1 // 당일 예보만 요청합니다.
  }); // 날씨 요청 주소를 만듭니다.
  return fetchApiData(requestUrl, "날씨 API"); // 실제 날씨 및 하루 예보를 가져옵니다.
} // 날씨 API 요청 함수를 마칩니다.

// 선택한 장소의 현재 대기질 지수를 요청합니다.
async function fetchAirQualityData(location) {
  const requestUrl = buildApiUrl(apiEndpoints.airQuality, { // 대기질 변수와 선택 장소를 요청 주소에 넣습니다.
    latitude: location.latitude, // 대기질을 조회할 위도입니다.
    longitude: location.longitude, // 대기질을 조회할 경도입니다.
    current: "european_aqi,pm2_5", // 유럽 통합 대기질 지수와 PM2.5를 요청합니다.
    timezone: "auto" // 선택 장소의 시간대를 사용합니다.
  }); // 대기질 요청 주소를 만듭니다.
  return fetchApiData(requestUrl, "대기질 API"); // 실제 대기질 결과를 가져옵니다.
} // 대기질 API 요청 함수를 마칩니다.

// 선택 장소 정보를 화면에 표시하고 날씨 API 요청을 시작합니다.
function selectLocation(location) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) { // 장소 이름과 위도·경도가 올바른지 검사합니다.
    showPageMessage("선택한 장소의 좌표를 확인할 수 없습니다. 다른 장소를 선택해 주세요."); // 잘못된 장소 선택을 안내합니다.
    return; // 좌표가 없으면 날씨 API를 요청하지 않습니다.
  } // 장소 좌표 검사를 마칩니다.
  knownLocations.set(location.id, location); // 다시 사용할 수 있도록 장소 정보를 보관합니다.
  selectedLocation = location; // 현재 선택한 장소를 갱신합니다.
  const thisWeatherRequestNumber = ++weatherRequestNumber; // 최신 날씨 요청인지 확인할 번호를 만듭니다.
  emptyState.hidden = true; // 장소 선택 전 안내 화면을 숨깁니다.
  weatherDashboard.hidden = false; // 날씨 정보 화면을 표시합니다.
  searchResultsSection.hidden = true; // 장소를 고른 뒤 검색 결과를 접습니다.
  clearWeatherValues(); // 이전 장소의 날씨가 남아 있지 않게 값을 비웁니다.
  document.querySelector("#location-name").textContent = location.name; // 선택한 장소 이름을 즉시 표시합니다.
  document.querySelector("#location-description").textContent = location.region; // 장소를 구분하는 지역 정보를 표시합니다.
  showWeatherMessage("Open-Meteo에서 날씨와 대기질 정보를 불러오고 있습니다."); // API 요청 중임을 알려줍니다.
  renderFavoriteLocations(); // 관심 장소 목록의 선택 상태를 갱신합니다.
  loadWeatherForLocation(location, thisWeatherRequestNumber); // 선택한 좌표로 날씨와 대기질 API를 호출합니다.
} // 장소 선택 함수를 마칩니다.

// 이전 장소의 값을 지워서 새 장소의 정보와 섞이지 않도록 합니다.
function clearWeatherValues() {
  document.querySelector("#weather-icon").textContent = "…"; // 날씨를 불러오는 동안 아이콘 자리에 진행 표시를 둡니다.
  document.querySelector("#current-temperature").textContent = "정보 없음"; // 이전 장소의 기온을 지웁니다.
  document.querySelector("#current-condition").textContent = "날씨 정보를 불러오는 중입니다."; // 진행 중임을 현재 상태 자리에 표시합니다.
  document.querySelector("#weather-updated").textContent = ""; // 이전 장소의 기준 시각을 지웁니다.
  document.querySelector("#rain-description").textContent = "강수 정보를 불러오는 중입니다."; // 이전 강수 안내를 지웁니다.
  document.querySelector("#feels-like").textContent = "정보 없음"; // 이전 체감온도를 지웁니다.
  document.querySelector("#humidity").textContent = "정보 없음"; // 이전 습도 값을 지웁니다.
  document.querySelector("#wind").textContent = "정보 없음"; // 이전 바람 값을 지웁니다.
  document.querySelector("#air-quality").textContent = "정보 없음"; // 이전 대기질 값을 지웁니다.
  document.querySelector("#air-quality-hint").textContent = "API 자료를 불러오는 중입니다."; // 대기질 조회 중임을 안내합니다.
  dailyForecast.replaceChildren(); // 이전 장소의 하루 예보를 지웁니다.
  const loadingMessage = document.createElement("p"); // 예보 로딩 문구를 만듭니다.
  loadingMessage.className = "forecast-empty"; // 예보 로딩 문구의 스타일을 지정합니다.
  loadingMessage.textContent = "오늘의 예보를 불러오고 있어요."; // 예보가 갱신 중임을 표시합니다.
  dailyForecast.append(loadingMessage); // 새 장소의 예보 영역에 진행 안내를 넣습니다.
} // 날씨 화면 초기화 함수를 마칩니다.

// 날씨와 대기질 API를 조회하고 최신 선택 장소의 결과만 화면에 표시합니다.
async function loadWeatherForLocation(location, requestNumber) {
  const [weatherResult, airQualityResult] = await Promise.allSettled([fetchWeatherData(location), fetchAirQualityData(location)]); // 날씨와 대기질 요청을 동시에 시작합니다.
  if (requestNumber !== weatherRequestNumber) { // 다른 장소가 새로 선택되었는지 확인합니다.
    return; // 늦게 도착한 이전 장소 응답은 화면에 반영하지 않습니다.
  } // 최신 장소 응답 확인을 마칩니다.
  if (weatherResult.status === "rejected") { // 현재 날씨 API가 실패했는지 검사합니다.
    clearWeatherValues(); // 실패 전에 남아 있을 수 있는 날씨 값을 제거합니다.
    document.querySelector("#current-condition").textContent = "날씨 정보를 표시할 수 없습니다."; // 날씨 값을 표시하지 못한 상태를 분명히 합니다.
    showWeatherMessage(`날씨 정보를 불러오지 못했습니다. ${getReadableApiError(weatherResult.reason)}`, true); // 실패 이유와 다시 시도 버튼을 표시합니다.
    return; // 현재 날씨가 없으면 정상 날씨 결과처럼 진행하지 않습니다.
  } // 필수 날씨 요청 실패 처리를 마칩니다.
  const weatherWasRendered = renderWeather(location, weatherResult.value, airQualityResult.status === "fulfilled" ? airQualityResult.value : null); // 성공한 날씨와 가능한 경우 대기질을 표시합니다.
  if (!weatherWasRendered) { // 응답 형식이 맞지 않아 날씨를 표시할 수 없었는지 확인합니다.
    return; // 날씨 응답 오류 안내를 대기질 성공 상태로 덮어쓰지 않습니다.
  } // 날씨 표시 여부 확인을 마칩니다.
  if (airQualityResult.status === "rejected") { // 대기질 API만 실패했는지 검사합니다.
    showWeatherMessage(`날씨는 표시했지만 대기질을 불러오지 못했습니다. ${getReadableApiError(airQualityResult.reason)}`, true); // 일부 데이터만 실패했음을 알리고 재시도 방법을 제공합니다.
  } else { // 두 API가 모두 성공했는지 처리합니다.
    weatherMessage.hidden = true; // 정상 조회가 끝나면 로딩 문구를 감춥니다.
  } // API 응답별 안내 처리를 마칩니다.
} // 선택 장소 날씨 조회 함수를 마칩니다.

// 선택 장소의 실제 API 날씨, 강수, 상세 정보와 오늘 예보를 화면에 채웁니다.
function renderWeather(location, weatherData, airQualityData) {
  const current = weatherData.current; // API에서 현재 날씨 자료를 가져옵니다.
  const daily = weatherData.daily; // API에서 당일 예보 자료를 가져옵니다.
  if (!current || !daily) { // 필수 현재 날씨와 예보 자료가 있는지 검사합니다.
    showWeatherMessage("날씨 API 응답에 필요한 정보가 없습니다. 다시 시도해 주세요.", true); // 누락된 응답을 임의의 값으로 바꾸지 않고 알립니다.
    return false; // 불완전한 날씨 자료를 화면에 그리지 않았음을 알립니다.
  } // 응답 데이터 검사를 마칩니다.
  document.querySelector("#location-name").textContent = location.name; // 날씨를 표시하는 장소 이름을 분명하게 표시합니다.
  document.querySelector("#location-description").textContent = location.region; // 장소를 구분하는 행정구역을 표시합니다.
  const currentWeather = getWeatherDescription(current.weather_code); // API 날씨 코드를 쉬운 문구와 아이콘으로 바꿉니다.
  document.querySelector("#weather-icon").textContent = currentWeather.icon; // 현재 날씨에 맞는 아이콘을 표시합니다.
  document.querySelector("#current-temperature").textContent = formatTemperature(current.temperature_2m); // API 현재 기온과 섭씨 단위를 표시합니다.
  document.querySelector("#current-condition").textContent = currentWeather.description; // 현재 날씨 상태를 쉬운 말로 표시합니다.
  document.querySelector("#weather-updated").textContent = formatApiTime(current.time); // API 자료의 현지 기준 시각을 표시합니다.
  document.querySelector("#feels-like").textContent = formatTemperature(current.apparent_temperature); // API 체감온도를 표시합니다.
  document.querySelector("#humidity").textContent = formatPercent(current.relative_humidity_2m); // API 습도와 백분율 단위를 표시합니다.
  document.querySelector("#wind").textContent = formatWindSpeed(current.wind_speed_10m); // API 바람 속도와 단위를 표시합니다.
  document.querySelector("#today-date").textContent = getTodayLabel(daily.time?.[0]); // API가 제공한 장소의 날짜를 한국어로 표시합니다.
  renderRainSummary(current, daily); // API 강수량과 오늘 강수 확률을 표시합니다.
  renderAirQuality(airQualityData); // API 대기질 정보 또는 자료 없음 안내를 표시합니다.
  renderDailyForecast(daily); // API 하루 상태와 최저·최고 기온을 표시합니다.
  updateFavoriteToggle(); // 관심 장소 저장 상태에 맞춰 버튼 문구를 갱신합니다.
  return true; // 날씨 정보를 정상적으로 표시했음을 호출한 곳에 알립니다.
} // 실제 날씨 표시 함수를 마칩니다.

// API 숫자 자료를 읽기 쉬운 형식으로 바꾸고 잘못된 값은 안내합니다.
function formatNumber(value, fractionDigits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) { // 숫자 자료가 없거나 유효하지 않은지 확인합니다.
    return "정보 없음"; // 임의의 기본 숫자를 만들지 않습니다.
  } // 숫자 확인을 마칩니다.
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: fractionDigits }).format(value); // 한국어 숫자 형식으로 반환합니다.
} // 숫자 표시 함수를 마칩니다.

// API 기온을 섭씨 기호와 함께 표시합니다.
function formatTemperature(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${formatNumber(value, 1)}°` : "정보 없음"; // 유효한 온도만 섭씨 기호와 표시합니다.
} // 기온 표시 함수를 마칩니다.

// API 습도를 백분율 기호와 함께 표시합니다.
function formatPercent(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${formatNumber(value)}%` : "정보 없음"; // 유효한 습도만 백분율로 표시합니다.
} // 습도 표시 함수를 마칩니다.

// API 바람 속도를 초속 미터 단위로 표시합니다.
function formatWindSpeed(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${formatNumber(value, 1)} m/s` : "정보 없음"; // 유효한 바람 값에 요청한 단위를 붙입니다.
} // 바람 표시 함수를 마칩니다.

// API가 반환한 현지 시각을 사용자에게 읽기 쉬운 형태로 표시합니다.
function formatApiTime(value) {
  if (typeof value !== "string" || !value.includes("T")) { // API 시간 값이 올바른지 확인합니다.
    return "API 기준 시각 정보 없음"; // 시간 정보가 없음을 분명히 표시합니다.
  } // API 시간 검사 처리를 마칩니다.
  return `현지 시각 ${value.split("T")[1].slice(0, 5)} 기준`; // 장소의 시간대 기준 시각을 표시합니다.
} // API 시간 표시 함수를 마칩니다.

// 세계기상기구 날씨 코드를 초보자가 이해하기 쉬운 문구로 바꿉니다.
function getWeatherDescription(weatherCode) {
  const descriptions = { // 자주 쓰이는 날씨 코드와 한국어 설명, 아이콘을 연결합니다.
    0: { description: "맑음", icon: "☀️" }, // 구름이 거의 없는 날씨입니다.
    1: { description: "대체로 맑음", icon: "🌤️" }, // 구름이 조금 있는 맑은 날씨입니다.
    2: { description: "구름 조금", icon: "⛅" }, // 구름과 해가 함께 보이는 날씨입니다.
    3: { description: "흐림", icon: "☁️" }, // 하늘이 구름으로 덮인 날씨입니다.
    45: { description: "안개", icon: "🌫️" }, // 안개가 낀 날씨입니다.
    48: { description: "짙은 안개", icon: "🌫️" }, // 얼음 안개가 낀 날씨입니다.
    51: { description: "이슬비", icon: "🌦️" }, // 약한 이슬비가 내리는 날씨입니다.
    53: { description: "이슬비", icon: "🌦️" }, // 보통 정도의 이슬비가 내리는 날씨입니다.
    55: { description: "강한 이슬비", icon: "🌧️" }, // 강한 이슬비가 내리는 날씨입니다.
    56: { description: "어는 이슬비", icon: "🌧️" }, // 어는 이슬비가 내리는 날씨입니다.
    57: { description: "강한 어는 이슬비", icon: "🌧️" }, // 강한 어는 이슬비가 내리는 날씨입니다.
    61: { description: "약한 비", icon: "🌦️" }, // 약한 비가 내리는 날씨입니다.
    63: { description: "비", icon: "🌧️" }, // 보통 정도의 비가 내리는 날씨입니다.
    65: { description: "강한 비", icon: "🌧️" }, // 강한 비가 내리는 날씨입니다.
    66: { description: "어는 비", icon: "🌧️" }, // 어는 비가 내리는 날씨입니다.
    67: { description: "강한 어는 비", icon: "🌧️" }, // 강한 어는 비가 내리는 날씨입니다.
    71: { description: "약한 눈", icon: "🌨️" }, // 약한 눈이 내리는 날씨입니다.
    73: { description: "눈", icon: "🌨️" }, // 보통 정도의 눈이 내리는 날씨입니다.
    75: { description: "강한 눈", icon: "❄️" }, // 강한 눈이 내리는 날씨입니다.
    77: { description: "싸락눈", icon: "🌨️" }, // 작은 얼음 알갱이가 내리는 날씨입니다.
    80: { description: "약한 소나기", icon: "🌦️" }, // 약한 소나기가 내리는 날씨입니다.
    81: { description: "소나기", icon: "🌧️" }, // 보통 정도의 소나기가 내리는 날씨입니다.
    82: { description: "강한 소나기", icon: "⛈️" }, // 강한 소나기가 내리는 날씨입니다.
    85: { description: "약한 눈 소나기", icon: "🌨️" }, // 약한 눈 소나기가 내리는 날씨입니다.
    86: { description: "강한 눈 소나기", icon: "❄️" }, // 강한 눈 소나기가 내리는 날씨입니다.
    95: { description: "뇌우", icon: "⛈️" }, // 천둥과 번개가 치는 날씨입니다.
    96: { description: "우박을 동반한 뇌우", icon: "⛈️" }, // 우박이 내릴 수 있는 뇌우입니다.
    99: { description: "강한 우박을 동반한 뇌우", icon: "⛈️" } // 강한 우박이 내릴 수 있는 뇌우입니다.
  }; // 날씨 코드 표를 정의합니다.
  return descriptions[weatherCode] || { description: "날씨 상태 정보 없음", icon: "🌡️" }; // 알 수 없는 코드는 정보 없음으로 안내합니다.
} // 날씨 코드 변환 함수를 마칩니다.

// 현재 강수량과 오늘 강수 예보를 확인해 별도의 강수 카드에 표시합니다.
function renderRainSummary(current, daily) {
  const rainDescription = document.querySelector("#rain-description"); // 강수 안내를 넣을 문단입니다.
  const currentPrecipitation = current.precipitation; // 현재 내리는 강수량입니다.
  const rainProbability = daily.precipitation_probability_max?.[0]; // 오늘 강수 확률의 최댓값입니다.
  const dailyPrecipitation = daily.precipitation_sum?.[0]; // 오늘 예상 강수량입니다.
  if (typeof currentPrecipitation === "number" && currentPrecipitation > 0) { // 현재 강수가 있는지 확인합니다.
    rainDescription.textContent = `현재 강수량 ${formatNumber(currentPrecipitation, 1)} mm입니다.`; // 현재 강수량을 실측과 혼동하지 않도록 API 값을 표시합니다.
    return; // 현재 강수 중이면 오늘의 요약 문구로 덮어쓰지 않습니다.
  } // 현재 강수 안내를 마칩니다.
  if (typeof rainProbability !== "number" || !Number.isFinite(rainProbability)) { // 오늘 강수 확률이 제공되는지 확인합니다.
    rainDescription.textContent = "강수 예보 정보가 없어요."; // 자료가 없을 때 숫자를 만들어내지 않습니다.
    return; // 제공되지 않은 강수 확률을 표시하지 않습니다.
  } // 강수 예보 확인을 마칩니다.
  if (rainProbability === 0 && (!Number.isFinite(dailyPrecipitation) || dailyPrecipitation === 0)) { // 강수 확률과 예상 강수량이 모두 없는지 확인합니다.
    rainDescription.textContent = "오늘은 강수 예보가 없어요."; // API 예보에 비가 없음을 안내합니다.
    return; // 비가 없는 경우 추가 문구를 만들지 않습니다.
  } // 강수 예보 없음 처리를 마칩니다.
  const precipitationText = Number.isFinite(dailyPrecipitation) && dailyPrecipitation > 0 ? ` 예상 강수량 ${formatNumber(dailyPrecipitation, 1)} mm.` : ""; // 양이 0보다 클 때만 예상 강수량을 표시합니다.
  rainDescription.textContent = `오늘 강수 확률 ${formatNumber(rainProbability)}%입니다.${precipitationText}`; // API 강수 확률과 제공되는 양을 표시합니다.
} // 강수 요약 표시 함수를 마칩니다.

// 유럽 통합 대기질 지수를 쉬운 상태 문구와 함께 보여줍니다.
function renderAirQuality(airQualityData) {
  const airQualityValue = document.querySelector("#air-quality"); // 대기질 상태를 표시할 카드입니다.
  const airQualityHint = document.querySelector("#air-quality-hint"); // 대기질 상태와 수치를 설명할 문장입니다.
  const airCurrent = airQualityData?.current; // API에서 현재 대기질 자료를 가져옵니다.
  const europeanIndex = airCurrent?.european_aqi; // 유럽 통합 대기질 지수 값입니다.
  if (typeof europeanIndex !== "number" || !Number.isFinite(europeanIndex)) { // 대기질 지수가 제공되는지 확인합니다.
    airQualityValue.textContent = "정보 없음"; // 지수가 없으면 임의의 등급을 표시하지 않습니다.
    airQualityHint.textContent = "대기질 자료를 확인할 수 없어요."; // 없는 자료를 사용자에게 알립니다.
    return; // 대기질 수치가 없으면 등급을 계산하지 않습니다.
  } // 대기질 지수 확인을 마칩니다.
  const category = getAirQualityCategory(europeanIndex); // 대기질 지수를 쉬운 등급으로 바꿉니다.
  airQualityValue.textContent = category; // 간결한 대기질 상태를 표시합니다.
  const particulateMatter = airCurrent.pm2_5; // 초미세먼지 농도 자료를 가져옵니다.
  const particulateText = typeof particulateMatter === "number" && Number.isFinite(particulateMatter) ? ` · PM2.5 ${formatNumber(particulateMatter, 1)} µg/m³` : ""; // 제공된 경우에만 초미세먼지 값을 덧붙입니다.
  airQualityHint.textContent = `유럽 AQI ${formatNumber(europeanIndex)}${particulateText}`; // 실제 대기질 지수와 초미세먼지 값을 표시합니다.
} // 대기질 표시 함수를 마칩니다.

// 유럽 AQI 구간을 한국어 대기질 상태로 바꿉니다.
function getAirQualityCategory(index) {
  if (index <= 20) { // 가장 낮은 지수 구간인지 확인합니다.
    return "좋음"; // 공기질이 좋은 상태입니다.
  } // 첫 번째 구간 확인을 마칩니다.
  if (index <= 40) { // 두 번째 지수 구간인지 확인합니다.
    return "보통"; // 공기질이 무난한 상태입니다.
  } // 두 번째 구간 확인을 마칩니다.
  if (index <= 60) { // 민감한 사람에게 주의가 필요한 구간인지 확인합니다.
    return "민감군 주의"; // 민감군이 주의할 상태입니다.
  } // 세 번째 구간 확인을 마칩니다.
  if (index <= 80) { // 나쁜 공기질 구간인지 확인합니다.
    return "나쁨"; // 공기질이 나쁜 상태입니다.
  } // 네 번째 구간 확인을 마칩니다.
  return "매우 나쁨"; // 가장 높은 지수 구간을 표시합니다.
} // 대기질 등급 변환 함수를 마칩니다.

// API의 당일 예보에서 날씨 상태, 최저·최고 기온과 강수 확률을 표시합니다.
function renderDailyForecast(daily) {
  dailyForecast.replaceChildren(); // 이전 장소의 예보가 남지 않도록 비웁니다.
  const highTemperature = daily.temperature_2m_max?.[0]; // 오늘 최고 기온 예보를 가져옵니다.
  const lowTemperature = daily.temperature_2m_min?.[0]; // 오늘 최저 기온 예보를 가져옵니다.
  const weatherCode = daily.weather_code?.[0]; // 오늘의 대표 날씨 코드를 가져옵니다.
  if (!Number.isFinite(highTemperature) || !Number.isFinite(lowTemperature) || !Number.isFinite(weatherCode)) { // 예보에 필요한 자료가 있는지 확인합니다.
    const emptyMessage = document.createElement("p"); // 예보가 없다는 안내 문단을 만듭니다.
    emptyMessage.className = "forecast-empty"; // 예보 안내에 스타일을 지정합니다.
    emptyMessage.textContent = "오늘의 예보 정보가 없어요."; // 없는 예보를 실제 값처럼 보여주지 않습니다.
    dailyForecast.append(emptyMessage); // 예보 안내를 화면에 표시합니다.
    return; // 예보 자료가 없으면 카드 내용을 만들지 않습니다.
  } // 예보 데이터 검사를 마칩니다.
  const forecastWeather = getWeatherDescription(weatherCode); // API 날씨 코드를 쉬운 문구와 아이콘으로 바꿉니다.
  const rainProbability = daily.precipitation_probability_max?.[0]; // 오늘 강수 확률을 가져옵니다.
  const forecastCard = document.createElement("div"); // 오늘 예보 카드를 구성할 영역을 만듭니다.
  forecastCard.className = "forecast-condition"; // 예보 날씨와 기온을 배치하는 기존 스타일을 사용합니다.
  forecastCard.innerHTML = `<span class="forecast-icon" aria-hidden="true">${forecastWeather.icon}</span><span><span class="forecast-day">오늘 하루</span><span class="forecast-description">${escapeHtml(forecastWeather.description)}</span></span>`; // API 예보 상태와 읽기 쉬운 설명을 표시합니다.
  const temperatureSummary = document.createElement("span"); // 최저·최고 기온을 표시할 영역을 만듭니다.
  temperatureSummary.className = "forecast-range"; // 기존 예보 기온 스타일을 적용합니다.
  temperatureSummary.textContent = `최고 ${formatTemperature(highTemperature)} · 최저 ${formatTemperature(lowTemperature)}`; // API가 제공한 최고·최저 기온을 표시합니다.
  const rainSummary = document.createElement("span"); // 예보 강수 확률을 표시할 영역을 만듭니다.
  rainSummary.className = "forecast-rain"; // 예보 강수 스타일을 적용합니다.
  rainSummary.textContent = typeof rainProbability === "number" && Number.isFinite(rainProbability) ? `비 가능성 ${formatNumber(rainProbability)}%` : "강수 정보 없음"; // 강수 확률이 없으면 없는 정보로 표시합니다.
  const forecastTemperatures = document.createElement("div"); // 기온과 강수 확률을 함께 배치합니다.
  forecastTemperatures.className = "forecast-temperatures"; // 예보 수치의 기존 배치 스타일을 적용합니다.
  forecastTemperatures.append(temperatureSummary, rainSummary); // 기온과 강수 확률을 예보 카드에 넣습니다.
  dailyForecast.append(forecastCard, forecastTemperatures); // 오늘 상태와 기온 정보를 화면에 표시합니다.
} // 하루 예보 표시 함수를 마칩니다.

// 현재 장소를 관심 장소로 저장하거나 목록에서 삭제합니다.
function toggleFavoriteLocation() {
  if (!selectedLocation) { // 현재 장소를 선택했는지 확인합니다.
    showPageMessage("관심 장소를 저장하려면 먼저 장소를 선택해 주세요."); // 선택이 필요하다는 안내를 표시합니다.
    return; // 선택 장소가 없으면 저장 목록을 바꾸지 않습니다.
  } // 장소 선택 확인을 마칩니다.
  const alreadySaved = favoriteLocations.some((location) => location.id === selectedLocation.id); // 같은 장소가 이미 저장되어 있는지 확인합니다.
  const previousFavorites = favoriteLocations; // 저장 실패 때 되돌릴 목록을 보관합니다.
  favoriteLocations = alreadySaved ? favoriteLocations.filter((location) => location.id !== selectedLocation.id) : [...favoriteLocations, selectedLocation]; // 현재 장소의 저장 여부를 반전합니다.
  if (!saveFavoriteLocations()) { // 브라우저 저장 공간에 새 목록을 기록했는지 확인합니다.
    favoriteLocations = previousFavorites; // 저장 실패 시 화면 상태를 이전 목록으로 되돌립니다.
    return; // 저장하지 못한 변경을 화면에 확정하지 않습니다.
  } // 저장 성공 여부 확인을 마칩니다.
  renderFavoriteLocations(); // 관심 장소 목록과 개수를 다시 그립니다.
  updateFavoriteToggle(); // 날씨 화면 저장 버튼을 갱신합니다.
} // 관심 장소 추가·삭제 함수를 마칩니다.

// 현재 장소의 관심 장소 저장 상태와 버튼 문구를 갱신합니다.
function updateFavoriteToggle() {
  const isSaved = Boolean(selectedLocation && favoriteLocations.some((location) => location.id === selectedLocation.id)); // 현재 장소가 저장 목록에 있는지 확인합니다.
  favoriteToggle.setAttribute("aria-pressed", String(isSaved)); // 저장 상태를 보조 기술에 전달합니다.
  favoriteToggle.querySelector("span").textContent = isSaved ? "★" : "☆"; // 저장 여부에 맞는 별 아이콘을 표시합니다.
  document.querySelector("#favorite-toggle-text").textContent = isSaved ? "저장됨 · 취소" : "관심 장소 저장"; // 상태를 분명한 문구로 안내합니다.
} // 관심 장소 버튼 갱신을 마칩니다.

// 저장된 장소 목록을 표시하고 각 장소를 다시 고르는 버튼을 만듭니다.
function renderFavoriteLocations() {
  favoritesList.replaceChildren(); // 이전 목록을 지워 중복 렌더링을 막습니다.
  favoritesCount.textContent = String(favoriteLocations.length); // 저장한 장소의 개수를 표시합니다.
  if (favoriteLocations.length === 0) { // 저장한 장소가 하나도 없는지 확인합니다.
    const emptyItem = document.createElement("li"); // 목록 안내를 넣을 항목을 만듭니다.
    emptyItem.className = "favorites-empty"; // 빈 목록 안내 스타일을 지정합니다.
    emptyItem.textContent = "아직 저장한 장소가 없어요."; // 빈 목록 안내를 표시합니다.
    favoritesList.append(emptyItem); // 안내 문구를 목록에 넣습니다.
    return; // 저장된 장소가 없으면 장소 버튼을 만들지 않습니다.
  } // 빈 목록 표시를 마칩니다.
  favoriteLocations.forEach((location) => { // 저장된 장소마다 한 행을 만듭니다.
    const listItem = document.createElement("li"); // 장소와 삭제 버튼을 담을 행을 만듭니다.
    listItem.className = "favorite-item"; // 관심 장소 행 스타일을 지정합니다.
    const selectButton = document.createElement("button"); // 저장 장소를 다시 고를 버튼을 만듭니다.
    selectButton.type = "button"; // 장소 선택이 양식을 제출하지 않게 합니다.
    selectButton.className = "favorite-place-button"; // 장소 이름 버튼에 스타일을 적용합니다.
    selectButton.textContent = location.name; // 버튼에 장소 이름을 표시합니다.
    selectButton.setAttribute("aria-current", String(location.id === selectedLocation?.id)); // 현재 선택 장소인지 보조 기술에 알립니다.
    selectButton.addEventListener("click", () => selectLocation(location)); // 누르면 이 장소의 날씨를 다시 조회합니다.
    const removeButton = document.createElement("button"); // 저장 목록 삭제 버튼을 만듭니다.
    removeButton.type = "button"; // 삭제 버튼이 양식을 제출하지 않게 합니다.
    removeButton.className = "favorite-remove-button"; // 삭제 버튼 스타일을 지정합니다.
    removeButton.textContent = "삭제"; // 삭제 버튼의 동작을 분명하게 표시합니다.
    removeButton.setAttribute("aria-label", `${location.name} 관심 장소 삭제`); // 삭제 대상을 보조 기술에 알립니다.
    removeButton.addEventListener("click", () => removeFavoriteLocation(location.id)); // 누르면 확인 절차를 거쳐 목록에서 제거합니다.
    listItem.append(selectButton, removeButton); // 장소 선택과 삭제 버튼을 한 행에 넣습니다.
    favoritesList.append(listItem); // 완성한 행을 저장 장소 목록에 추가합니다.
  }); // 모든 저장 장소 행을 그립니다.
} // 관심 장소 목록 렌더링을 마칩니다.

// 사용자가 삭제를 확인하면 해당 장소를 관심 목록에서 제거합니다.
function removeFavoriteLocation(locationId) {
  const locationToRemove = favoriteLocations.find((location) => location.id === locationId); // 삭제 대상 정보를 찾습니다.
  if (!locationToRemove) { // 삭제 대상이 목록에 실제로 있는지 확인합니다.
    showPageMessage("삭제할 장소 정보를 찾을 수 없습니다."); // 잘못된 삭제 요청임을 안내합니다.
    return; // 목록에 없는 장소는 삭제하지 않습니다.
  } // 삭제 대상 확인을 마칩니다.
  const confirmed = window.confirm(`${locationToRemove.name}을(를) 관심 장소에서 삭제할까요?`); // 의도한 삭제인지 한 번 더 확인합니다.
  if (!confirmed) { // 사용자가 취소했는지 확인합니다.
    return; // 취소한 경우 목록을 그대로 둡니다.
  } // 삭제 확인을 마칩니다.
  const previousFavorites = favoriteLocations; // 저장 실패 때 되돌릴 목록을 보관합니다.
  favoriteLocations = favoriteLocations.filter((location) => location.id !== locationId); // 선택한 장소만 목록에서 제외합니다.
  if (!saveFavoriteLocations()) { // 변경 목록을 저장할 수 있는지 확인합니다.
    favoriteLocations = previousFavorites; // 저장 실패 시 이전 목록으로 복구합니다.
    return; // 저장하지 못한 상태를 화면에 반영하지 않습니다.
  } // 저장 성공 확인을 마칩니다.
  renderFavoriteLocations(); // 변경된 관심 장소 목록을 다시 그립니다.
  updateFavoriteToggle(); // 현재 장소가 삭제된 경우 저장 버튼도 갱신합니다.
} // 관심 장소 삭제 함수를 마칩니다.

// 날씨 로딩이나 오류 상황을 알리고 필요한 경우 재시도 버튼을 제공합니다.
function showWeatherMessage(message, includeRetryButton = false) {
  weatherMessage.replaceChildren(); // 이전 안내와 버튼을 지웁니다.
  weatherMessage.hidden = false; // 상태 안내 영역을 화면에 표시합니다.
  weatherMessage.append(document.createTextNode(message)); // 안내 문구를 텍스트로 추가합니다.
  if (includeRetryButton) { // 재시도 버튼이 필요한 상황인지 확인합니다.
    const retryButton = document.createElement("button"); // 다시 시도 버튼을 만듭니다.
    retryButton.type = "button"; // 버튼이 양식을 제출하지 않게 합니다.
    retryButton.className = "retry-button"; // 다시 시도 버튼의 스타일을 지정합니다.
    retryButton.textContent = "다시 시도"; // 버튼이 수행할 동작을 알려줍니다.
    retryButton.addEventListener("click", retryWeatherDisplay); // 누르면 현재 장소를 다시 요청합니다.
    weatherMessage.append(retryButton); // 상태 문구 옆에 버튼을 표시합니다.
  } // 재시도 버튼 처리를 마칩니다.
} // 날씨 안내 표시 함수를 마칩니다.

// 선택한 장소의 날씨 API를 다시 요청합니다.
function retryWeatherDisplay() {
  if (!selectedLocation) { // 다시 조회할 장소가 선택되어 있는지 확인합니다.
    showWeatherMessage("날씨를 조회할 장소를 먼저 선택해 주세요."); // 장소 선택을 요청합니다.
    return; // 선택 장소가 없으면 API를 호출하지 않습니다.
  } // 선택 장소 확인을 마칩니다.
  const thisWeatherRequestNumber = ++weatherRequestNumber; // 새 요청을 최신 요청으로 표시합니다.
  clearWeatherValues(); // 이전 요청에 실패한 값이나 안내를 지웁니다.
  showWeatherMessage("Open-Meteo에서 최신 정보를 다시 불러오고 있습니다."); // 다시 요청 중임을 알립니다.
  loadWeatherForLocation(selectedLocation, thisWeatherRequestNumber); // 선택 장소의 날씨와 대기질을 다시 요청합니다.
} // 날씨 재요청 함수를 마칩니다.

// 검색 양식 제출을 실제 장소 검색 API 요청으로 연결합니다.
searchForm.addEventListener("submit", (event) => {
  event.preventDefault(); // 검색할 때 페이지가 새로고침되지 않게 합니다.
  searchLocations(searchInput.value); // 입력한 장소를 Open-Meteo 지오코딩 API로 검색합니다.
}); // 검색 양식 이벤트 연결을 마칩니다.

// 검색 결과 버튼을 누르면 해당 장소의 날씨를 조회합니다.
searchResults.addEventListener("click", (event) => {
  const resultButton = event.target.closest("[data-location-id]"); // 실제로 누른 검색 결과 버튼을 찾습니다.
  if (resultButton) { // 검색 결과 버튼을 눌렀는지 확인합니다.
    const location = knownLocations.get(resultButton.dataset.locationId); // 검색 때 보관한 좌표와 이름을 가져옵니다.
    if (location) { // 장소 정보가 있는지 확인합니다.
      selectLocation(location); // 선택한 장소의 실제 날씨 API를 호출합니다.
    } else { // 검색 결과의 장소 정보가 사라진 경우를 처리합니다.
      showPageMessage("장소 정보를 찾을 수 없습니다. 다시 검색해 주세요."); // 검색 결과가 유효하지 않음을 알립니다.
    } // 장소 선택 처리를 마칩니다.
  } // 검색 결과 클릭 처리를 마칩니다.
}); // 검색 결과 이벤트 연결을 마칩니다.

// 빠른 지역 버튼을 누르면 해당 좌표의 실제 날씨를 조회합니다.
document.querySelector(".demo-map").addEventListener("click", (event) => {
  const mapPin = event.target.closest("[data-location-id]"); // 누른 빠른 지역 버튼을 찾습니다.
  if (mapPin) { // 지역 버튼을 눌렀는지 확인합니다.
    const location = knownLocations.get(mapPin.dataset.locationId); // 미리 준비한 대표 좌표를 찾습니다.
    if (location) { // 해당 지역이 목록에 있는지 확인합니다.
      selectLocation(location); // 대표 지역의 날씨와 대기질을 요청합니다.
    } // 대표 지역 선택 처리를 마칩니다.
  } // 지역 버튼 클릭 처리를 마칩니다.
}); // 빠른 지역 선택 이벤트 연결을 마칩니다.

// 관심 장소 버튼을 저장과 저장 해제 동작에 연결합니다.
favoriteToggle.addEventListener("click", toggleFavoriteLocation); // 관심 장소 버튼에 클릭 동작을 등록합니다.

// 처음 페이지가 열릴 때 날짜와 저장 장소 목록을 표시합니다.
todayDate.textContent = getTodayLabel(); // 선택 전 화면의 날짜를 준비합니다.
favoriteLocations = loadFavoriteLocations(); // 저장된 장소 이름과 좌표를 브라우저에서 복원합니다.
renderFavoriteLocations(); // 복원한 관심 장소를 목록에 표시합니다.
