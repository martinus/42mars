;redcode
;name Bewitching '88
;author S.Fernandes
;strategy scanner
;assert CORESIZE == 8000

step    equ     -436

eye     mov     slow        ,    <hit+step
scan    add     #step       ,    eye
        jmz     scan        ,    @eye
hit     mov     @jump       ,    @eye
        jmn     eye         ,    hit

slow    spl     0           ,    <clear-11
clear   mov     cleanup     ,    <clear-6
jump    jmp     clear       ,    0

cleanup dat     <2667       ,    <-11

        end     scan+1

