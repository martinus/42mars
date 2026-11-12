;redcode-nano
;name ImpClear3
;author Roy van Rijn
;strategy Imp and dclear
;assert 1
bomb    equ -22 
        spl     >imp    , >34
        spl     #-21    , >bomb
        mov     bomb-1  , >-2
        djn.f   -1      , >-3
imp     mov.i   #-25    , 0
end
