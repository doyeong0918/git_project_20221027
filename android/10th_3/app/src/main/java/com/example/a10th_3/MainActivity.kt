package com.example.a10th_3

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var txtResult: TextView
    private var expression = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        txtResult = findViewById(R.id.txtResult)

        // 숫자 버튼
        val numberButtons = listOf(
            R.id.btn0, R.id.btn1, R.id.btn2,
            R.id.btn3, R.id.btn4, R.id.btn5,
            R.id.btn6, R.id.btn7, R.id.btn8,
            R.id.btn9
        )

        for (id in numberButtons) {
            findViewById<Button>(id).setOnClickListener {
                val button = it as Button
                expression += button.text.toString()
                updateDisplay()
            }
        }

        // 연산자 버튼
        val operatorButtons = listOf(
            R.id.btnPlus,
            R.id.btnMinus,
            R.id.btnMultiply,
            R.id.btnDivide
        )

        for (id in operatorButtons) {
            findViewById<Button>(id).setOnClickListener {
                val button = it as Button
                val operator = when (button.id) {
                    R.id.btnPlus -> "+"
                    R.id.btnMinus -> "-"
                    R.id.btnMultiply -> "*"
                    R.id.btnDivide -> "/"
                    else -> ""
                }

                if (expression.isNotEmpty()) {
                    if (expression.last() in "+-*/") {
                        expression = expression.dropLast(1)
                    }
                    expression += operator
                    updateDisplay()
                }
            }
        }

        // 소수점
        findViewById<Button>(R.id.btnDot).setOnClickListener {
            val currentNumber = expression
                .takeLastWhile { it !in "+-*/" }

            if (currentNumber.isEmpty()) {
                expression += "0."
            } else if (!currentNumber.contains(".")) {
                expression += "."
            }

            updateDisplay()
        }

        // 전체 삭제
        findViewById<Button>(R.id.btnClear).setOnClickListener {
            expression = ""
            updateDisplay()
        }

        // 마지막 글자 삭제
        findViewById<Button>(R.id.btnBack).setOnClickListener {
            if (expression.isNotEmpty()) {
                expression = expression.dropLast(1)
            }
            updateDisplay()
        }

        // 계산
        findViewById<Button>(R.id.btnEqual).setOnClickListener {
            try {
                if (expression.isNotEmpty()) {
                    val result = Calculator(expression).calculate()
                    expression = formatResult(result)
                    updateDisplay()
                }
            } catch (e: Exception) {
                txtResult.text = "Error"
                expression = ""
            }
        }
    }

    private fun updateDisplay() {
        txtResult.text = if (expression.isEmpty()) "0" else expression
    }

    private fun formatResult(value: Double): String {
        return if (value % 1.0 == 0.0) {
            value.toLong().toString()
        } else {
            value.toString()
        }
    }

    // 사칙연산 계산기
    class Calculator(private val input: String) {

        private var position = 0

        fun calculate(): Double {
            val result = parseExpression()

            if (position != input.length || !result.isFinite()) {
                throw IllegalArgumentException("잘못된 계산식")
            }

            return result
        }

        // 덧셈, 뺄셈
        private fun parseExpression(): Double {
            var result = parseTerm()

            while (position < input.length) {
                when (input[position]) {
                    '+' -> {
                        position++
                        result += parseTerm()
                    }
                    '-' -> {
                        position++
                        result -= parseTerm()
                    }
                    else -> break
                }
            }

            return result
        }

        // 곱셈, 나눗셈
        private fun parseTerm(): Double {
            var result = parseNumber()

            while (position < input.length) {
                when (input[position]) {
                    '*' -> {
                        position++
                        result *= parseNumber()
                    }
                    '/' -> {
                        position++
                        val divisor = parseNumber()

                        if (divisor == 0.0) {
                            throw ArithmeticException("0으로 나눌 수 없음")
                        }

                        result /= divisor
                    }
                    else -> break
                }
            }

            return result
        }

        // 숫자 읽기
        private fun parseNumber(): Double {
            val start = position

            if (position < input.length &&
                input[position] == '-') {
                position++
            }

            while (position < input.length &&
                (input[position].isDigit() ||
                        input[position] == '.')) {
                position++
            }

            if (start == position) {
                throw IllegalArgumentException("숫자 없음")
            }

            return input.substring(start, position).toDouble()
        }
    }
}
