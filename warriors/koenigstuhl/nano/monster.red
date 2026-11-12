;redcode-nano
;name the monster over the hill
;author John Metcalf
;strategy what's that coming over the hill?
;strategy is it a monster? Is it a MONSTER!
;assert CORESIZE==80

    step  equ 5
    first equ bomb+5

ptr: sub   #-step,    #first
wipe:jmz.f ptr,      @ptr
    mov   bomb,     >ptr
    djn.f wipe,     {ptr-7
bomb:mov.i #2,       -1
    end   wipe

