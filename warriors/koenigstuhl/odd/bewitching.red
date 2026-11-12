;redcode
;name Bewitching
;author S.Fernandes
;strategy scanner
;assert 1
;       CORESIZE == 8192

	org	jump

step    equ     3199
time    equ     1410

attack  mov     slow        ,    >scan
        mov     jump        ,    @scan
scan    add     #step       ,    #jump-time*step
jump    jmz.f   scan        ,    @scan
        djn     attack      ,    scan
slow    spl     #0          ,    0
clear   mov     cleanup     ,    >clear-3
        djn.f   clear       ,    >clear-3
cleanup dat     <2731       ,    7
        end
