;redcode-tiny
;name Liquid fire II
;author G.Labarga
;assert CORESIZE==800
;strategy clear/imp

        iloc equ imp+70
        istep equ 267

gate:   dat >267,imp+83
bmb:    dat >267,7
        dat 0,0
clr:    spl #0,>gate
        mov bmb,>gate
        djn.f -1,>gate
for 6
        dat 0,0
rof
start:
clgo:   spl clr, >gate-110
        mov imp,iloc
        spl 1           ,}iloc+(6*istep)
        spl 1           ,}iloc+(4*istep)
        spl 2           ,}iloc+(2*istep)
first:  djn.a >first    ,#iloc+(0*istep)
        djn.a @first+1  ,#iloc+(1*istep)
imp:    mov.i #istep,*0
end start

