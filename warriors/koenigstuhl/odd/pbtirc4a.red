;redcode
;name PBT IRC4-A
;strategy Mini IRC Tournament 4
;assert 1

NME     EQU     (d1-10)

d1:     dat     1,          1
start:  spl     next,       {NME+3
        mov.i   bmb,        NME
        mov.i   bmb,        NME+4
        mov.i   bmb,        NME+8
bmb:    dat     <1,         <-1
next:   mov.i   bmb,        NME+2
        mov.i   bmb,        NME+6
        mov.i   bmb,        NME+10
        jmp     #0,         >NME+5

    end start

