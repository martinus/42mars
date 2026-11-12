;redcode-tiny
;name Tiny Dread Pirate
;author S.Fernandes
;strategy oneshot for CGM round 4
;       CORESIZE == 800
;assert 1

        org     loop+1

step    equ     136
gap     equ     7
first   equ     loop+step

ptr     dat     first+gap   ,    first

        dat     0           ,    0

x       dat     1           ,    10
clear   spl     #267        ,    10
        mov     *x          ,    >ptr
        mov     *x          ,    >ptr
        djn.f   clear+1     ,    }clear

        for     4
        dat     0           ,    0
        rof

loop    add     inc         ,    ptr
        sne     *ptr        ,    @ptr
        add     inc         ,    ptr
        sne     *ptr        ,    @ptr
        djn.f   loop        ,    *ptr
        djn.f   clear       ,    ptr
inc     jmp     #step       ,    step

        end

