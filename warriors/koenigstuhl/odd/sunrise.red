;redcode-94nop
;name Sunrise
;author Roy van Rijn
;strategy Paper designed after the one from Sunset
;strategy Designed for R12 (Read/Write limits)
;assert 1

pGo     spl     2       , >288
        spl     1       , >191
        spl     1       , <111

pPap1   spl     320     , {3
        mov     }2      , }-1
        mov     3       , >399
        mov     3       , }-3
        jmz.f   -4      , *-1
        dat     <215    , <145
        dat     0       , 0
end
