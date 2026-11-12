;redcode-94x
;name Bewitching
;author S.Fernandes
;strategy scanner
;assert CORESIZE==55440

        org     jump
step    equ     (5*31*37*41)

attack  mov     slow        ,    >scan
        mov     jump        ,    @scan
scan    add     #step       ,    #jump+step
jump    jmz.f   scan        ,    @scan
        djn     attack      ,    scan
slow    spl     #0          ,    0
clear   mov     cleanup     ,    >clear-3
        djn.f   clear       ,    >clear-3
        dat     0           ,    0
cleanup dat     <1          ,    7
        end

