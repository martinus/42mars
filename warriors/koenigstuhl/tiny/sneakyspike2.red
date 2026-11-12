;redcode-tiny
;name Sneaky Spike 2
;author Roy van Rijn
;strategy Last one... I promise
;assert 1

        add.f   sAdd    , @5
start   sne.i   }-65    , >-72
        djn.f   -2      , <173

sAdd    spl     #357    , {357
        mov.i   @2      , >-3
        mov.i   @1      , >-4
        djn.f   -2      , {bomb

        dat     }-181   , }11
bomb    spl     #-181   , }12

end start

