;redcode-94
;name As You Wish
;author S.Fernandes
;strategy scanner for CGM round 3
;assert CORESIZE == 8000

        mul.f   scan        ,    scan
        mul.f   scan        ,    scan
        jmp     jump        ,    {scan

        for     3
        dat     0           ,    0
        rof

attack  mov     *slow       ,    >scan
        mov     jump        ,    @scan
scan    add     #6          ,    #6
jump    jmz.f   scan        ,    @scan
        djn     attack      ,    scan
slow    spl     #0          ,    0
clear   mov     cleanup     ,    >clear-4
        djn.f   clear       ,    >clear-4

        dat     0           ,    0

cleanup dat     1           ,    8

        end
