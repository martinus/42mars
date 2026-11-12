;redcode
;name Dragon's Lair
;author Christian Schmidt
;strategy
;assert 1

top    mov bmb, xEnd+2
       mov bmb, xEnd+6
       mov bmb, xEnd+7
start  spl top
       mov bmb, xEnd+8
       mov bmb, xEnd+4
       mov bmb, xEnd+9

bottom mov bmb, <xEnd
       jmp -1
bmb
xEnd   dat 0, start-1

end  start