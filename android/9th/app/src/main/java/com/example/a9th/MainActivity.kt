
package com.example.a9th

import android.os.Bundle
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    lateinit var textView: TextView
    lateinit var textView3: TextView
    lateinit var result: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_main)

        textView = findViewById(R.id.textView)
        textView3 = findViewById(R.id.textView3)
        result = findViewById(R.id.result)
    }

    fun onButton(view: View) {

        val num1 = textView.text.toString().toInt()
        val num2 = textView3.text.toString().toInt()

        val sum = num1 + num2
        result.text = sum.toString()
        Toast.makeText(applicationContext, "$sum", Toast.LENGTH_SHORT).show()
    }
}
