;redcode-nano
;name Ucekupatox
;author G.Labarga
;assert CORESIZE==80
;strategy Scanner
;strategy Randomly named

loop:   add #-5,scan
scan:   jmz.a loop,-7
        mov bmb,>scan
        jmp scan,<35
bmb:    mov.i #0,{0
end scan

