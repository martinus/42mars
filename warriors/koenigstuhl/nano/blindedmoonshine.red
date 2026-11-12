;redcode-nano
;name blinded by moonshine 8
;author Neogryzor/FatalC
;strategy double clear
;assert CORESIZE == 80

boot equ clr+35

        mov }st,>st
st:     mov clr,boot
        spl boot,{-10
clr:    mov {30,-5
        djn.f {0,}0

end st-1
