package com.example.a2th

import android.R
import androidx.core.graphics.component4
import org.junit.Test

import org.junit.Assert.*

/**
 * Example local unit test, which will execute on the development machine (host).
 *
 * See [testing documentation](http://d.android.com/tools/testing).
 */
class ExampleUnitTest {
    @Test
    fun addition_isCorrect() {
        assertEquals(4, 2 + 2)
        val myName = "김도영"

        val age: Int = 24

        println("나이: " + age + "\n" + "이름: " + myName)

        var numOne = 1
        var numTwo = 30000000
        var myByte: Byte = 1
        var myInt: Int = 20

        println(
            "numOne: " + numOne + ", numTwo: " + numTwo +
                    ", myByte: " + myByte + ", myInt: " + myInt
        )

        var myFloat: Float = 30.2F
        var myDouble: Double = 35.4
        var myBoolean: Boolean = true

        println("Float: " + myFloat)
        println("Double: " + myDouble)
        println("Boolean: " + myBoolean)

        var myChar1: Char = 'K'
        var myChar2: Char = 'o'
        var myChar3: Char = 't'
        var myChar4: Char = 'l'
        var myChar5: Char = 'i'
        var myChar6: Char = 'n'

        var myString1: String = "Kotlin"
        var myString2: String = "Java"

        println("Char: " + myChar1 + myChar2 + myChar3 + myChar4 + myChar5 + myChar6)
        println("String: " + myString1)
        println("String: " + myString2)

        var myArray: IntArray = intArrayOf(1,2,3,4,5)
        println("Array: " + myArray[2])

        var myX: Int = 100
        var myY: Float = myX.toFloat()
        println("자료형 변환 Int: " + myX)
        println("자료형 변환 Long: " + myY)

        var x: Int = 5
        var y: Int = 2

        println("산술연산자 x + y: " + (x + y))
        println("산술연산자 x - y: " + (x - y))
        println("산술연산자 x * y: " + (x * y))
        println("산술연산자 x / y: " + (x / y))
        println("산술연산자 x % y: " + (x % y))


        println("비교 연산자 > : " + (x > y))
        println("비교 연산자 < : " + (x < y))
        println("비교 연산자 >=: " + (x >= y))
        println("비교 연산자 <= : " + (x <= y))
        println("비교 연산자 == : " + (x == y))
        println("비교 연산자 != : " + (x != y))

        y += x
        println("할당 연산자 +=: " + y)

        y -= x
        println("할당 연산자 -=: " + y)

        y *= x
        println("할당 연산자 *=: " + y)

        y /= x
        println("할당 연산자 /=: " + y)

        y %= x
        println("할당 연산자 %=: " + y)


        var a: Int = 1

        println("증감 연산자 ++ : " + ++a)
        println("증감 연산자 -- : " + --a)

        var num: Int = 10
        if(num % 2 == 0)
            println("짝수")
        else
            println("홀수")

        var num1: Int = -10
        var result: String

        if(num1 > 0){
            result = "양수"
        }
        else if(num == 0){
            result = "0"
        }
        else{
            result = "음수"
        }

        println(result)

     var num2: Int = -10
     var result1: String
     if(num2 > 0){
        if(num2 % 2 == 0){
            result1 = "양수이고 짝수이다"
        }else{
            result1 = "양수이고 홀수이다"
        }
     }
     else{
         if(num2 % 2 == 0){
             result1 = "음수이고 짝수이다"
         }else{
             result1 = "음수이고 홀수이다"
         }
     }
        println(result1)
    //When 문
     var day: Int = 2
     var result2: String

     when (day){
         1 -> result2 = "Monday"
         2 -> result2 = "Tuseday"
         3 -> result2 = "Wednesday"
         4 -> result2 = "Thursday"
         5 -> result2 = "Friday"
         6 -> result2 = "Saturday"
         7 -> result2 = "Sunday"
         else -> result2 = "Invalid day"
     }

        println(result2)


        for( i in 5 downTo 1){
            println(i)
        }

        for( i in 5 downTo 1 step 2){
            print("" + i)
        }

        var numbers = arrayOf(1, 2, 3, 4, 5)
        for ( i in numbers){
            println("for 반복문 반복변수" + i)
        }
        var f: Int = 80
        var grade: Int = 70
        var result3: String

        if(f >= 80){
            if(grade >= 90)
                result3 = "A학점"
            else if(grade >= 80)
                result3 = "B학점"
            else if(grade >= 70)
                result3 = "C학점"
            else
                result3 = "F학점"
        }
        else{
            result3 = "F(낙제)"
        }

        println(result3)

    }
}