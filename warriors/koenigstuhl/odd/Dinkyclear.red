;redcode-94
;name D:inky clear
;author David Houston
;assert 1

org     clear



wptr:   dat     1, 40
        jmp     #2, 40
        dat     2, 40


        for     25
        dat     0, 0
        rof

clear  mov     *wptr, >wptr
        jmp     -1, <1000


