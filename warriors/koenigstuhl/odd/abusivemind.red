;redcode-94odd
;name AbusiveMind
;author Roy van Rijn
;assert 1
;strategy Use the boot dist and don't scan the bombs

sPtr    dat     2715    , 101    ;scan ptr and bomb the decoy :)
        add     #81     , sPtr
sScan   jmz     -1      , @sPtr
        djn.b   2       , @sPtr  ;check if we hit a bomb
        jmp     -3      , <-100  ;jump back
        add.ba  sPtr    , sPtr
        mov.i   sBmb    , }sPtr
        djn.f   -1      , >sPtr
sBmb    dat     <1      , >1
end     sScan
