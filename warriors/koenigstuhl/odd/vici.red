;redcode
;name Vici
;author Christian Schmidt
;strategy
;assert 1

bmb    dat 0,  -1
top    mov bmb, <-1
       jmp -1

start  spl top
       spl bottom
       mov bmb, xEnd+3
       mov bmb, xEnd+5
       mov bmb, xEnd+7
bottom  mov bmb, >-1
xEnd    jmp -1

end  start