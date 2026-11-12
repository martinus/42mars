;redcode-odd
;name Larry
;author Sascha Zapf
;strategy Hopper
;assert CORESIZE==8000
;identify Scanners

mgate   EQU     -200
step    EQU     -3017
gate    EQU     3*step+20

start   spl     start,  }start
        jmp     hop,    }gate
ptr     dat.f   #ptr,   #step
hop     mov.i   }ptr,   >ptr
        spl     step-1, >-89

        end     start