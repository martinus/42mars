;redcode
;name Stone
;Tournament: ICWST'90
;Standard: CWS'88
;author Matthew Householder
;assert 1

start   mov     <2,     3
        add     d1,     start
        jmp     start
        dat             #0
d1      dat     #-5084,  #5084
        end     start
