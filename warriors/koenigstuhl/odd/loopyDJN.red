;redcode-94nop
;name LoopyDJN
;author John Metcalf
;strategy looping paper
;assert CORESIZE==8000

paper   mov.i  #49,      -1
copy    mov    *paper-1, {dest
        djn.a  copy,     paper-1
        spl    paper-1,  {-1277
dest    djn.f  5620,     {0


