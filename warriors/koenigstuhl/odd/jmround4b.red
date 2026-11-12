;redcode-tiny
;name Curiosity
;author John Metcalf
;strategy CLP
;       CORESIZE==800
;assert 1

     high  equ (clp+23)
     low   equ (clp-28)
     dist  equ (clp+530)

clp     mov    #dbmb+1,  #dbmb+1
        mov    *ptr,     @ptr

wait    mov    dbmb,     {dbmb
ptr     sne    high,     low
        djn.f  wait,     >esc  

move    mov    <clp,     {esc
        jmn    move,     clp
esc     jmp    dist,     high+21

dbmb    dat    low-15,   <1

        end    clp+1

