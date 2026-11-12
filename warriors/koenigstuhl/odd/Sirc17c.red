;redcode
;name S:IRC17c
;author Philip Thorne
;       CORESIZE==2520
;assert 1

start:  spl     #35,        >-35
        mov.i   -2,         }start
        jmp     -1,         >start-35

    end start
