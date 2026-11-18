package com.example.a11th

import android.os.Bundle
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : AppCompatActivity() {

    lateinit var imageView: ImageView   // 물음표 등딱지를 달고 있는 달팽이
    lateinit var resultText: TextView   // 정답입니다 / 틀렸습니다

    // 정답은 2번
    val answer = 2

    // 1번~4번 버튼을 눌렀을 때 보여줄 그림 (달팽이 등에 누른 등딱지가 올라간 모습)
    val snailImages = intArrayOf(
        R.drawable.snail_answer_1,
        R.drawable.snail_answer_2,
        R.drawable.snail_answer_3,
        R.drawable.snail_answer_4
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        // 폰이 다크 모드여도 흰 배경 그림이 그대로 보이도록 라이트 모드로 고정
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)

        imageView = findViewById(R.id.imageView)
        resultText = findViewById(R.id.resultText)

        val button1: ImageButton = findViewById(R.id.button1)
        val button2: ImageButton = findViewById(R.id.button2)
        val button3: ImageButton = findViewById(R.id.button3)
        val button4: ImageButton = findViewById(R.id.button4)

        button1.setOnClickListener { selectShell(1) }
        button2.setOnClickListener { selectShell(2) }
        button3.setOnClickListener { selectShell(3) }
        button4.setOnClickListener { selectShell(4) }

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
    }

    // number : 누른 등딱지 번호 (1~4)
    fun selectShell(number: Int) {
        // 누른 등딱지를 달팽이에 씌우기
        imageView.setImageResource(snailImages[number - 1])

        // 정답(2번)이면 "정답입니다", 아니면 "틀렸습니다"
        if (number == answer) {
            resultText.text = "정답입니다"
        } else {
            resultText.text = "틀렸습니다"
        }
    }
}
