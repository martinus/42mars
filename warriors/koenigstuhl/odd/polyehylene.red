;redcode-rf20
;name Polyethylene
;author Roy van Rijn
;strategy Paper created from Pool C
;assert 1

bOff    equ     start+(2448/16)

;PoolC

PC00   spl    @    3077 , #       2
PC01   spl    $      -3 , {       3 ; # into { -- 4 AP
PC02   mov.i  }      -1 , }      -1 ; > into } -- 4 AP
PC03   mov.i  }      22 , >       5
PC04   dat    <    2667 , <    5334
PC05   mov.ab #       0 , >       7
PC06   sne.i  $    3044 , $    3364
PC07   sne.x  $      20 , $      11
PC08   seq.f  *    1143 , *      13
PC09   seq.b  $    1203 , <      17
PC10   mov.i  $    2376 , }      -7 ; $ into } -- 4 AP
PC11   mov.ab $       4 , @      19
PC12   jmz.f  $       1 , $      23
PC13   djn.x  $    1111 , <      29
PC14   djn.a  $      -4 , #    1000
PC15   spl    #      12 , #      31
PC16   add.ba #    2365 , $      -3
PC17   add.x  $       0 , $      37
PC18   slt.a  $     889 , $    2383
PC19   jmp    $   -2667 , $      41
PC20   mul.ab #      -8 , $      43
PC21   mov.i  #    3315 , *      47
PC22   mov.i  #      -1 , $      53
PC23   spl    $    4072 , <    2936
PC24   jmn    $      -2 , @      59

;create our monster:

start   mov.i   PC01            , bOff
        mov.ba  PC18            , bOff

        mov.i   PC02            , bOff+1
        mov.ba  PC00            , bOff+1

        mov.i   PC10            , bOff+2
        mov.x   PC01            , bOff+2
        mov.ab  PC23            , bOff+2

        mov.i   PC10            , bOff+3
        mov.x   PC01            , bOff+3

        mov.i   PC12            , bOff+4
        mov.a   PC14            , bOff+4
        mov.b   PC00            , bOff+4

        mov.i   PC04            , bOff+5

;created the warrior
;now clear and start it

        spl     2
        spl     1
        spl     1
        mov.i   clear           , > ptr1
        mov.i   clear           , > ptr1
        mov.i   clear           , > ptr1
        mov.i   clear           , > ptr1
        mov.i   clear           , > ptr1
        mov.i   clear           , > ptr1
        mov.i   clear           , > ptr1
        mov.i   clear           , > ptr1
ptr1    jmp     bOff            , PC00
clear	dat	0		, 0


; The AP list:

;1) Change B-Field adressing mode of PC01       : 4 AP
;2) Change A-Field adressing mode of PC02       : 4 AP
;3) Change B-Field adressing mode of PC10       : 4 AP
;4) Leaving one instruction after boot...dammit  : 1 AP

;   Total used AP's                             : 13 AP


end start

