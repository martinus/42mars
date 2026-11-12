;redcode-94nop
;name No offense and can't count
;author Roy van Rijn
;assert 1

sStep   equ     5235
sTimes  equ     7999

        mov     empty   , sEnd
        mov     -149    , 151       ;This line makes the scanlines equal
        sne     -150    , 150           ;Scan the scanlines
sCnt    djn.b   -1      , #sTimes       ;Loopback and count
        seq.ab  #0      , -1          ;if count isn't over
        jmp     sStart                ;then jump to copy
        add     #3948   , sCnt          ;if count IS over:
        djn.b   sStart  , #2            ;count again!
empty   dat     0       , 0             ;or suicide!
sStart  mov.i   {sEnd   , {sPtr
        djn.b   -1      , sPtr
sPtr    jmp     sStep   , #12
sEnd    dat     0       , 0

end sCnt-1
