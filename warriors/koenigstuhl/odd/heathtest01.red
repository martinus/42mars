;redcode-94
;name HeathTest01
;author Heath Caldwell
;assert 1

linelen         equ     (157)
blocklen        equ     (5)

        org     start

x       dat     #0, #0
y       dat     #0, #0
pos     dat     #0, #0
loc     dat     #0, #0
spot    dat     #0, #0
pic     dat     #1, #1
        dat     #3, #1
        dat     #5, #1
        dat     #6, #1
        dat     #7, #1
        dat     #10, #1
        dat     #13, #1
        dat     #14, #1
        dat     #15, #1
        dat     #17, #1
        dat     #19, #1

        dat     #1, #2
        dat     #3, #2
        dat     #5, #2
        dat     #9, #2
        dat     #11, #2
        dat     #14, #2
        dat     #17, #2
        dat     #19, #2

        dat     #1, #3
        dat     #2, #3
        dat     #3, #3
        dat     #5, #3
        dat     #6, #3
        dat     #7, #3
        dat     #9, #3
        dat     #10, #3
        dat     #11, #3
        dat     #14, #3
        dat     #17, #3
        dat     #18, #3
        dat     #19, #3

        dat     #1, #4
        dat     #3, #4
        dat     #5, #4
        dat     #9, #4
        dat     #11, #4
        dat     #14, #4
        dat     #17, #4
        dat     #19, #4

        dat     #1, #5
        dat     #3, #5
        dat     #5, #5
        dat     #6, #5
        dat     #7, #5
        dat     #9, #5
        dat     #11, #5
        dat     #14, #5
        dat     #17, #5
        dat     #19, #5

picaddr dat     #0, pic

start   mov.ab  #pic+1, picaddr

newpic  mov.f   @picaddr, loc
        jmz.b   start, picaddr
        mov.ab  #last+1, spot

        mov.a   loc, spot
        mul.a   #blocklen, spot
        add.ab  spot, spot
        mov.a   #linelen, spot
        mul.a   #blocklen, spot
        mul.ba  loc, spot
        add.ab  spot, spot 

        mov.ab  #blocklen, y
col     mov.ab  #blocklen, x
row     mov.f   pic, @spot

        add.ab  #1, spot
        djn.b   row, x

        add.ab  #linelen, spot
        sub.ab  #blocklen, spot
        djn.b   col, y

        add.ab  #1, picaddr
last    jmp     newpic

        end 

