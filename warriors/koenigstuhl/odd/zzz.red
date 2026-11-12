;redcode-94
;name zZz
;author Christian Schmidt
;strategy suicidal clear 2
;assert 1

;26 slt 
bmb    dat 0,  -20
;27 mov 
top    mov bmb, <bmb
;28 mov 
       mov bmb, <bmb
;29 mul 
chck   nop <bmb, <bmb
;30 sub 
       sub.ab #0, 0
;31 mov 
       mov bmb, <bmb
;32 mov 
       mov bmb, <bmb
;33 jmz    
       jmz.b top, bmb-1

end top

