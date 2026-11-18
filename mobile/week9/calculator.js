"use strict";

// 결과 화면, 이전 계산 화면, 버튼 영역을 HTML에서 찾아 변수에 저장합니다.
const currentValueDisplay = document.querySelector("#current-value");
const previousValueDisplay = document.querySelector("#previous-value");
const keypad = document.querySelector(".keypad");

// 계산기 상태: 현재 숫자, 이전 숫자, 선택한 연산자, 다음 숫자를 새로 입력할지 여부입니다.
let currentInput = "0";
let previousInput = "";
let selectedOperator = null;
let resetInputOnDigit = false;

// 현재 숫자와 이전 계산 정보를 화면에 반영합니다.
function updateDisplay() {
  currentValueDisplay.textContent = currentInput;
  previousValueDisplay.textContent = selectedOperator
    ? `${previousInput} ${selectedOperator}`
    : "";
}

// 입력한 숫자를 한국어 음성으로 읽어줍니다.
function speakDigit(digit) {
  const koreanDigits = ["영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  speakText(koreanDigits[Number(digit)]);
}

// 전달된 문장을 한국어 음성으로 읽어줍니다.
function speakText(text) {
  const speech = new SpeechSynthesisUtterance(text);

  speech.lang = "ko-KR";
  window.speechSynthesis.speak(speech);
}

// 선택한 사칙연산의 이름을 한국어 음성으로 읽어줍니다.
function speakOperator(operator) {
  const operatorNames = {
    "+": "더하기",
    "-": "빼기",
    "×": "곱하기",
    "÷": "나누기",
  };

  speakText(operatorNames[operator]);
}

// 입력한 숫자를 현재 숫자에 추가하고 화면을 갱신합니다.
function inputDigit(digit) {
  speakDigit(digit);

  // 연산자나 오류 다음에 숫자를 입력하면 기존 숫자 대신 새 숫자를 시작합니다.
  if (currentInput === "오류" || resetInputOnDigit) {
    currentInput = digit;
    resetInputOnDigit = false;
  // 숫자가 너무 길어져 화면을 넘치지 않도록 최대 15자리까지만 받습니다.
  } else if (currentInput.replace(".", "").length < 15) {
    currentInput = currentInput === "0" ? digit : currentInput + digit;
  }

  updateDisplay();
}

// 현재 숫자에 소수점을 한 번만 추가합니다.
function inputDecimal() {
  // 새 숫자를 입력하는 중이면 0부터 소수 입력을 시작합니다.
  if (currentInput === "오류" || resetInputOnDigit) {
    currentInput = "0.";
    resetInputOnDigit = false;
  // 현재 숫자에 소수점이 아직 없을 때만 추가합니다.
  } else if (!currentInput.includes(".")) {
    currentInput += ".";
  }

  updateDisplay();
}

// 연산자를 선택하고, 이어서 계산할 값이 있으면 먼저 계산합니다.
function chooseOperator(operator) {
  speakOperator(operator);

  // 오류가 표시된 상태에서 연산자를 누르면 초기 상태에서 다시 시작합니다.
  if (currentInput === "오류") {
    clearCalculator();
  }

  // 연산자가 이미 있고 두 번째 숫자도 입력했다면 앞선 계산을 먼저 처리합니다.
  if (selectedOperator && !resetInputOnDigit) {
    calculate();
  }

  previousInput = currentInput;
  selectedOperator = operator;
  resetInputOnDigit = true;
  updateDisplay();
}

// 이전 숫자와 현재 숫자에 선택된 사칙연산을 적용합니다.
function calculate() {
  // 계산할 연산자나 이전 숫자가 없으면 계산하지 않습니다.
  if (!selectedOperator || previousInput === "") {
    return;
  }

  const left = Number(previousInput);
  const right = Number(currentInput);
  let result;

  // 선택된 기호에 맞는 사칙연산을 수행합니다.
  switch (selectedOperator) {
    case "+":
      result = left + right;
      break;
    case "-":
      result = left - right;
      break;
    case "×":
      result = left * right;
      break;
    case "÷":
      if (right === 0) {
        currentInput = "오류";
        previousInput = "";
        selectedOperator = null;
        resetInputOnDigit = true;
        updateDisplay();
        return;
      }
      result = left / right;
      break;
    default:
      return;
  }

  currentInput = Number.isFinite(result)
    // 부동소수점 계산 오차를 줄이고 결과를 읽기 쉬운 숫자로 표시합니다.
    ? String(Number(result.toPrecision(12)))
    : "오류";
  previousInput = "";
  selectedOperator = null;
  resetInputOnDigit = true;
  updateDisplay();
}

// 현재 입력과 선택된 연산자를 모두 초기화합니다.
function clearCalculator() {
  currentInput = "0";
  previousInput = "";
  selectedOperator = null;
  resetInputOnDigit = false;
  updateDisplay();
}

// 현재 숫자의 마지막 글자를 지웁니다.
function deleteLastDigit() {
  // 결과 화면이거나 다음 숫자 입력 대기 중이면 현재 숫자를 초기화합니다.
  if (currentInput === "오류" || resetInputOnDigit) {
    clearCalculator();
    return;
  }

  currentInput = currentInput.length > 1 ? currentInput.slice(0, -1) : "0";
  if (currentInput === "-") {
    currentInput = "0";
  }
  updateDisplay();
}

// 클릭한 계산기 버튼에 맞는 입력 또는 연산을 실행합니다.
function handleButtonClick(event) {
  // 실제로 누른 버튼을 찾고, 버튼 바깥을 누른 경우에는 아무 작업도 하지 않습니다.
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  if (button.dataset.digit !== undefined) {
    inputDigit(button.dataset.digit);
  } else if (button.dataset.operator) {
    chooseOperator(button.dataset.operator);
  } else if (button.dataset.action === "decimal") {
    inputDecimal();
  } else if (button.dataset.action === "clear") {
    speakText("초기화");
    clearCalculator();
  } else if (button.dataset.action === "delete") {
    deleteLastDigit();
  } else if (button.dataset.action === "equals") {
    speakText("계산");
    calculate();
  }
}

// 키보드 입력을 계산기의 숫자, 연산, 삭제 기능에 연결합니다.
function handleKeyboardInput(event) {
  // 누른 키를 숫자, 연산자, 계산, 삭제 또는 초기화 동작으로 연결합니다.
  if (/^[0-9]$/.test(event.key)) {
    inputDigit(event.key);
  } else if (event.key === ".") {
    inputDecimal();
  } else if (["+", "-"].includes(event.key)) {
    chooseOperator(event.key);
  } else if (event.key === "*") {
    chooseOperator("×");
  } else if (event.key === "/") {
    event.preventDefault();
    chooseOperator("÷");
  } else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    speakText("계산");
    calculate();
  } else if (event.key === "Backspace") {
    deleteLastDigit();
  } else if (event.key === "Escape") {
    speakText("초기화");
    clearCalculator();
  }
}

// 버튼 영역에 클릭 이벤트를 한 번만 등록해 모든 버튼 입력을 처리합니다.
keypad.addEventListener("click", handleButtonClick);
// 키보드 입력 이벤트를 등록해 버튼을 누르지 않고도 계산할 수 있게 합니다.
window.addEventListener("keydown", handleKeyboardInput);
