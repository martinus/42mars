;redcode-nano
;name Master of the Core
;author John Metcalf
;strategy testing new qscan
;assert CORESIZE==80

    scan  equ ptr+12
    clear equ ptr+22

    seq   scan+5,   scan
ptr: mov.x #clear,   #scan-4
loop:mov   db,       }ptr
    djn.f loop,     }ptr
db:  dat   4,        >1
    end

