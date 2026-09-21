package com.example.a2th

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


    }
}