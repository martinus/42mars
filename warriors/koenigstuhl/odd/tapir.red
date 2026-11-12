;redcode-94nop quiet
;name Tapir
;author Roy van Rijn
;strategy .66c chain vampire
;assert 1

        vPit1   equ  2177
        vStep1  equ  2149
        vStep2  equ  5177
        vTimes  equ  242;198

f2      jmp     -vStep2         , <vStep1
dd      dat     >0              , btm-f2+3
cc      spl     #1              , btm-f2+4

        dat     0               , 0
        dat     0               , 0
        dat     0               , 0

scan    sub.f   f1              , fang1
        mov.i   f1              , *fang1
        mov.i   f2              , @fang1
fang1   mov.i   clr+vPit1+vStep1, @clr+vPit1+vStep2
        djn.b   scan            , #vTimes

clr     spl     #0              , 0
        mov.i   @1              , >f2
btm     djn.b   -1              , {cc

        dat     0               , 0
        dat     0               , 0
        dat     0               , 0
        dat     0               , 0

wBoot   mov     pit2            , <bPtr1
        mov     clr             , <bPtr1
        mov     clr             , <bPtr1
bPtr1   jmp     scan+1          , clr+vPit1+3
pit2    jmp     -2
f1      jmp     -vStep1         , <-vStep2

end wBoot
