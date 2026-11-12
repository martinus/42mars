;redcode-nano
;author inversed
;name [RS] EvoTrick II
;strategy qBomb -> Clear
;strategy Evolved with RedShift
;strategy spl's b-field increment modifies the clear
;assert CORESIZE==80

        mov     < 44    ,     13
        mov     < 38    ,     47

s0      spl     # 69    ,   > 32
loop    mov     * 15    ,   { s0
        djn.f     loop  ,     s0

