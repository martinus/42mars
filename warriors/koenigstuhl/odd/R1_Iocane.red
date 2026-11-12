;redcode-94
;name Iocane
;author S.Fernandes
;strategy scanner for CGM round 1
;assert CORESIZE == 8000

        org     decoy

step    equ     1681
sep     equ     8

target  mov.b   scan        ,    #speedup
wipe    mov     *bomb       ,    >target
loop    add     inc         ,    scan
scan    seq     }1+step     ,    1+step-sep
        djn.f   target      ,    @target
speedup jmn.a   loop        ,    target+1
inc     spl     #1681       ,    <1681
clear   mov     cleanup     ,    >clear-4
        djn.f   clear       ,    >clear-4
cleanup dat     1           ,    10

        for     4
        dat     0           ,    0
        rof

bomb    spl     #0          ,    <2667

        for     76-4
        dat     0           ,    0
        rof

colour  equ     target+5000

decoy   mov    >colour      ,   <colour+7     
        mov    <colour+8    ,   {colour+15
        mov    <colour+16   ,   {colour+23
        mov    <colour+24   ,   {colour+30
        mov    <colour+31   ,   {colour+37
        mov    <colour+38   ,   {colour+45
        mov    <colour+46   ,   {colour+52
        mov    <colour+53   ,   {colour+60
        djn.f  scan         ,   <colour+68

        end

