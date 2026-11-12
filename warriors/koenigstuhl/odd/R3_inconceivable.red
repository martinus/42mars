;redcode-94
;name Inconceivable
;author S.Fernandes
;strategy I don't think it switches how you think it switches
;strategy scanner for CGM round 3
;assert CORESIZE == 8000

        org     fixup

sep     equ     8

target  mov.b   scan        ,    #speedup
wipe    mov     *loop       ,    >target
loop    add     inc         ,    scan
scan    seq     }1          ,    1-sep
        djn.f   target      ,    @target
speedup jmp     loop
inc     spl     #1          ,    <1
clear   mov     cleanup     ,    >clear-5
        djn.f   clear       ,    >clear-4
cleanup dat     1           ,    8

        for     35
        dat     0           ,    0
        rof

fixup   mul.x   *1          ,    *1
        add.f   build       ,    *build
        mul.f   *build      ,    }build
build   djn.f   >6          ,    @-7

        end

