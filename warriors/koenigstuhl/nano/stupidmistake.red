;redcode-nano
;author Roy van Rijn
;name Stupid mistake
;strategy Scanner with invisible bomb that works the same as mov 0,-1
;assert 1

        add     #-5     , #-6
        jmz.f   -1      , @-1
        mov.i   bomb    , >-2
        jmp     -2      , <-10
bomb    mov.i   0       , <0

end 1

