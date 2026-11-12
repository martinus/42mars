;redcode-94
;name D: OneKiller
;assert 1
;author Roy van Rijn



;looks familier John? the SLT idea is yours!
sPtr    dat     0       ,       0
sAdd    add.f   sBmb    ,       sPtr
        slt     #2      ,       @sPtr   ;skip if something
        slt     *sPtr   ,       #2      ;skip if nothing
        djn.f   2       ,       sPtr    ;  jump to wipe
        djn.f   sAdd    ,       @sPtr   ;loop the scanloop

        seq     *sPtr   ,       sPtr-1  ;switch the pointer
        mov.x   sPtr    ,       sPtr

        mov     3       ,       >-4     ;dclear!
        mov     2       ,       >-5
        djn.f   -2      ,       >-6     ;naa naa nana naaaa..we have djn!
sBmb    dat     >-10    ,       >15
end sAdd

