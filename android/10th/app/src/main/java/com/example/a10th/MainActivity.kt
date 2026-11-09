
package com.example.a10th

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.view.inputmethod.InputMethodManager
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        // EditText 연결
        val name = findViewById<EditText>(R.id.editTextText1)
        val password = findViewById<EditText>(R.id.editTextText2)
        val phone = findViewById<EditText>(R.id.editTextText3)
        val email = findViewById<EditText>(R.id.editTextText4)

        // 버튼과 TextView 연결
        val button = findViewById<Button>(R.id.button)
        val result = findViewById<TextView>(R.id.textView)

        // 출력 버튼 클릭
        button.setOnClickListener {

            // 입력값 가져오기
            val nameText = name.text.toString()
            val passwordText = password.text.toString()
            val phoneText = phone.text.toString()
            val emailText = email.text.toString()

            // 키보드 숨기기
            val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
            currentFocus?.let {
                imm.hideSoftInputFromWindow(it.windowToken, 0)
            }

            // 화면에 결과 출력
            result.text = """
                이름: $nameText
                비밀번호: $passwordText
                전화번호: $phoneText
                이메일: $emailText
            """.trimIndent()
        }
    }
}
